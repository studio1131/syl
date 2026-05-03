import { createClient } from '@sanity/client'
import { Readable } from 'stream'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

export const config = { maxDuration: 300 }

const PROJECT_ID = process.env.SANITY_PROJECT_ID
const DATASET    = process.env.SANITY_DATASET || 'production'

// Cache resolved audio URLs in memory for the function lifetime
const urlCache = new Map()

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
    const redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    ratelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'), prefix: 'sylhera:audio' })
  }
  return ratelimit
}

async function checkRateLimit(ip) {
  const rl = getRatelimit()
  if (rl) {
    const { success } = await rl.limit(ip)
    return success
  }
  return memRateLimit(ip, 60, 60 * 1000)
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    return res.status(405).end()
  }

  const ip = (
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  ).split(',')[0].trim()

  const allowed = await checkRateLimit(ip)
  if (!allowed) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  const { id } = req.query
  if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9_.-]{1,80}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid track ID' })
  }

  if (!PROJECT_ID) {
    return res.status(503).json({ error: 'Not configured' })
  }

  // Resolve audio URL server-side only — never sent to client
  let audioUrl = urlCache.get(id)
  if (!audioUrl) {
    try {
      const client = createClient({
        projectId: PROJECT_ID,
        dataset:   DATASET,
        apiVersion: '2024-01-01',
        useCdn: false,
      })
      const track = await client.fetch(
        `*[_type == "track" && _id == $id][0]{ "audioUrl": audioFile.asset->url }`,
        { id }
      )
      if (!track || !track.audioUrl) {
        return res.status(404).json({ error: 'Track not found' })
      }
      audioUrl = track.audioUrl
      urlCache.set(id, audioUrl)
    } catch (err) {
      console.error('Audio resolve error:', err)
      return res.status(500).json({ error: 'Failed to resolve track' })
    }
  }

  // Proxy with Range support for seeking
  const upstreamHeaders = {}
  if (req.headers['range']) {
    upstreamHeaders['Range'] = req.headers['range']
  }

  let upstream
  try {
    upstream = await fetch(audioUrl, { headers: upstreamHeaders })
  } catch (err) {
    console.error('Audio fetch error:', err)
    return res.status(502).json({ error: 'Failed to fetch audio' })
  }

  const status      = upstream.status === 206 ? 206 : 200
  const contentType = upstream.headers.get('content-type') || 'audio/mpeg'

  res.status(status)
  res.setHeader('Content-Type', contentType)
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  const contentLength = upstream.headers.get('content-length')
  if (contentLength) res.setHeader('Content-Length', contentLength)

  const contentRange = upstream.headers.get('content-range')
  if (contentRange) res.setHeader('Content-Range', contentRange)

  // Stream audio through — Sanity CDN URL stays server-side
  try {
    Readable.fromWeb(upstream.body).pipe(res)
  } catch (err) {
    if (!res.headersSent) res.status(502).end()
  }
}
