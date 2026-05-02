import { createClient } from '@sanity/client'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED     = /^https:\/\/(sylhera\.vercel\.app|sylhera-studio1131s-projects\.vercel\.app)$/i

// In-memory fallback when Redis is not configured
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
  if (!ratelimit) {
    const redis = new Redis({
      url:   process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '60 m'),
      prefix:  'sylhera:request',
    })
  }
  return ratelimit
}

function sanitize(input) {
  if (typeof input !== 'string') return ''
  return input.trim().replace(/[<>]/g, '').substring(0, 1000)
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const origin = req.headers.origin || ''
  if (origin && !ALLOWED.test(origin) && !/^http:\/\/localhost(:\d+)?$/i.test(origin)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown'

  // Distributed rate limit (Redis) with in-memory fallback
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { success } = await getRatelimit().limit(ip)
    if (!success) return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  } else {
    if (!memRateLimit(ip, 5, 3_600_000)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' })
    }
  }

  const { item, firstName, lastName, email, message, website, _t } = req.body

  if (website) return res.status(400).json({ error: 'Bad request' })
  if (!_t || Date.now() - Number(_t) < 1500) return res.status(400).json({ error: 'Bad request' })

  if (!item || !firstName || !lastName || !email) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' })
  }

  const doc = {
    _type:       'totemRequest',
    item:        sanitize(item),
    firstName:   sanitize(firstName),
    lastName:    sanitize(lastName),
    email:       sanitize(email).toLowerCase(),
    message:     sanitize(message || ''),
    status:      'new',
    submittedAt: new Date().toISOString(),
  }

  try {
    if (process.env.SANITY_PROJECT_ID) {
      const client = createClient({
        projectId:  process.env.SANITY_PROJECT_ID,
        dataset:    process.env.SANITY_DATASET || 'production',
        token:      process.env.SANITY_WRITE_TOKEN,
        apiVersion: '2024-01-01',
        useCdn:     false,
      })
      const result = await client.create(doc)
      return res.status(200).json({ success: true, id: result._id })
    }

    console.log('Totem request (Sanity not configured):', doc)
    return res.status(200).json({ success: true, id: `local-${Date.now()}` })
  } catch (error) {
    console.error('Request submission error:', error)
    return res.status(500).json({ error: 'Internal server error. Please try again later.' })
  }
}
