import { createClient } from '@sanity/client'
import { createHmac, timingSafeEqual } from 'crypto'
import { Readable } from 'stream'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

export const config = { maxDuration: 300 }

const PROJECT_ID  = process.env.SANITY_PROJECT_ID
const DATASET     = process.env.SANITY_DATASET || 'production'
const SIGNING_KEY = process.env.AUDIO_SIGNING_SECRET || ''

// Per-track cache: { audioUrl, id3Skip, totalSize }
const trackCache = new Map()

// ── Rate limiting ──────────────────────────────────────────────────────────
const memStore = new Map()
function memRateLimit(ip, max, windowMs) {
  const now = Date.now()
  const recent = (memStore.get(ip) || []).filter(t => now - t < windowMs)
  if (recent.length >= max) return false
  recent.push(now)
  memStore.set(ip, recent)
  return true
}
let ratelimit
function getRatelimit() {
  if (ratelimit) return ratelimit
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
    ratelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'), prefix: 'sylhera:audio' })
  }
  return ratelimit
}
async function checkRateLimit(ip) {
  const rl = getRatelimit()
  if (rl) { const { success } = await rl.limit(ip); return success }
  return memRateLimit(ip, 60, 60000)
}

// ── Token verification ─────────────────────────────────────────────────────
// Token format: base64url(id:expiry).base64url(hmac)
function verifyToken(token, id) {
  if (!SIGNING_KEY) return true  // dev mode — skip when env not set
  if (!token || typeof token !== 'string') return false
  const dot = token.indexOf('.')
  if (dot < 0) return false
  const encodedPayload = token.slice(0, dot)
  const receivedSig    = token.slice(dot + 1)
  let payload
  try { payload = Buffer.from(encodedPayload, 'base64url').toString('utf8') } catch { return false }
  const colon = payload.lastIndexOf(':')
  if (colon < 0) return false
  if (payload.slice(0, colon) !== id) return false
  if (parseInt(payload.slice(colon + 1), 10) < Math.floor(Date.now() / 1000)) return false
  const expected = createHmac('sha256', SIGNING_KEY).update(payload).digest('base64url')
  try {
    const a = Buffer.from(receivedSig, 'utf8')
    const b = Buffer.from(expected,    'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch { return false }
}

// ── ID3v2 metadata stripping ───────────────────────────────────────────────
// ID3v2 tags sit at byte 0 and encode their own size in a 28-bit syncsafe int.
// Stripping them removes DAW name, encoder, creation software, etc.
function parseId3Skip(buf) {
  if (buf.length < 10) return 0
  if (buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return 0  // "ID3"
  const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) |
               ((buf[8] & 0x7f) <<  7) |  (buf[9] & 0x7f)
  return 10 + size
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') return res.status(405).end()

  const ip = ((req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown')
    .split(',')[0]).trim()
  if (!await checkRateLimit(ip)) return res.status(429).end()

  const { id, t } = req.query
  if (!id || !/^[a-zA-Z0-9_.-]{1,80}$/.test(id)) return res.status(400).end()
  if (!verifyToken(t, id)) return res.status(403).end()
  if (!PROJECT_ID) return res.status(503).end()

  // ── Resolve track (cached) ──
  let entry = trackCache.get(id)
  if (!entry) {
    try {
      const client = createClient({ projectId: PROJECT_ID, dataset: DATASET, apiVersion: '2024-01-01', useCdn: false })
      const track  = await client.fetch(`*[_type=="track"&&_id==$id][0]{"url":audioFile.asset->url}`, { id })
      if (!track?.url) return res.status(404).end()
      entry = { audioUrl: track.url, id3Skip: null, totalSize: null }
      trackCache.set(id, entry)
    } catch { return res.status(500).end() }
  }

  // ── Determine ID3 skip (cached after first request) ──
  if (entry.id3Skip === null) {
    try {
      const r   = await fetch(entry.audioUrl, { headers: { Range: 'bytes=0-9' } })
      entry.id3Skip = parseId3Skip(Buffer.from(await r.arrayBuffer()))
    } catch { entry.id3Skip = 0 }
  }
  const skip = entry.id3Skip

  // ── Parse client Range header ──
  const rangeHeader = req.headers['range'] || ''
  const rm          = rangeHeader.match(/bytes=(\d+)-(\d*)/)
  const isRange     = !!rm
  const clientStart = rm ? parseInt(rm[1], 10) : 0
  const clientEnd   = rm && rm[2] ? parseInt(rm[2], 10) : null

  // ── Build upstream range (offset by id3Skip) ──
  let upstreamRange
  if (isRange) {
    const adjStart = clientStart + skip
    const adjEnd   = clientEnd !== null ? clientEnd + skip : ''
    upstreamRange  = `bytes=${adjStart}-${adjEnd}`
  } else if (skip > 0) {
    upstreamRange = `bytes=${skip}-`
  }

  // ── Fetch from Sanity CDN (URL never leaves server) ──
  let upstream
  try {
    upstream = await fetch(entry.audioUrl, upstreamRange ? { headers: { Range: upstreamRange } } : {})
  } catch { return res.status(502).end() }

  const upstreamCL = upstream.headers.get('content-length')
  const upstreamCR = upstream.headers.get('content-range')

  // Cache total stripped size from first content response
  if (entry.totalSize === null) {
    if (upstreamCR) {
      const m = upstreamCR.match(/\/(\d+)$/)
      if (m) entry.totalSize = parseInt(m[1], 10) - skip
    } else if (upstreamCL) {
      entry.totalSize = parseInt(upstreamCL, 10)
    }
  }

  // ── Build response headers ──
  const status = isRange ? 206 : (upstreamRange ? 200 : upstream.status)
  res.status(status)
  res.setHeader('Content-Type', 'audio/mpeg')            // generic — hides format details
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Cache-Control', 'private, no-store')    // no CDN caching
  res.setHeader('Content-Disposition', 'inline')         // no "Save As" prompt
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.removeHeader('X-Powered-By')

  if (upstreamCL) res.setHeader('Content-Length', upstreamCL)

  if (isRange && entry.totalSize !== null) {
    const end = clientEnd !== null ? clientEnd : entry.totalSize - 1
    res.setHeader('Content-Range', `bytes ${clientStart}-${end}/${entry.totalSize}`)
  }

  // ── Stream — Sanity CDN URL never exposed ──
  try { Readable.fromWeb(upstream.body).pipe(res) }
  catch { if (!res.headersSent) res.status(502).end() }
}
