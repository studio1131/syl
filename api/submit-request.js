// api/submit-request.js — saves totem requests to Sanity
import { createClient } from '@sanity/client'

const RATE_LIMIT = 5
const rateLimit  = new Map()
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function sanitize(input) {
  if (typeof input !== 'string') return ''
  return input.trim().replace(/[<>]/g, '').substring(0, 1000)
}

function checkRateLimit(ip) {
  const now = Date.now()
  const recent = (rateLimit.get(ip) || []).filter(t => now - t < 3_600_000)
  if (recent.length >= RATE_LIMIT) return false
  recent.push(now)
  rateLimit.set(ip, recent)
  return true
}

const cors = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({})
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed', ...cors })

  try {
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress

    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.', ...cors })
    }

    const { item, firstName, lastName, email, message } = req.body

    if (!item || !firstName || !lastName || !email) {
      return res.status(400).json({ error: 'Missing required fields', ...cors })
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email address', ...cors })
    }

    const doc = {
      _type: 'totemRequest',
      item:       sanitize(item),
      firstName:  sanitize(firstName),
      lastName:   sanitize(lastName),
      email:      sanitize(email).toLowerCase(),
      message:    sanitize(message || ''),
      status:     'new',
      submittedAt: new Date().toISOString()
    }

    if (process.env.SANITY_PROJECT_ID) {
      const client = createClient({
        projectId: process.env.SANITY_PROJECT_ID,
        dataset:   process.env.SANITY_DATASET || 'production',
        token:     process.env.SANITY_WRITE_TOKEN,
        apiVersion: '2024-01-01',
        useCdn: false
      })
      const result = await client.create(doc)
      return res.status(200).json({ success: true, id: result._id, ...cors })
    }

    // Sanity not configured — log and acknowledge
    console.log('Totem request (Sanity not configured):', doc)
    return res.status(200).json({ success: true, id: `local-${Date.now()}`, ...cors })

  } catch (error) {
    console.error('Request submission error:', error)
    return res.status(500).json({ error: 'Internal server error. Please try again later.', ...cors })
  }
}
