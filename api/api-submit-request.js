// api/submit-request.js
// Temporary stub — Sanity removed. Validates and logs submissions only.

const RATE_LIMIT = 5
const rateLimit = new Map()
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function sanitizeInput(input) {
  if (typeof input !== 'string') return ''
  return input.trim().replace(/[<>]/g, '').substring(0, 1000)
}

function checkRateLimit(ip) {
  const now = Date.now()
  const recent = (rateLimit.get(ip) || []).filter(t => now - t < 3600000)
  if (recent.length >= RATE_LIMIT) return false
  recent.push(now)
  rateLimit.set(ip, recent)
  return true
}

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({})
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', ...corsHeaders })
  }

  try {
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress

    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.', ...corsHeaders })
    }

    const { item, firstName, lastName, email, message } = req.body

    if (!item || !firstName || !lastName || !email) {
      return res.status(400).json({ error: 'Missing required fields', ...corsHeaders })
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email address', ...corsHeaders })
    }

    const sanitizedData = {
      item: sanitizeInput(item),
      firstName: sanitizeInput(firstName),
      lastName: sanitizeInput(lastName),
      email: sanitizeInput(email).toLowerCase(),
      message: sanitizeInput(message || ''),
      submittedAt: new Date().toISOString(),
    }

    console.log('Request received (Sanity disabled):', sanitizedData)

    return res.status(200).json({
      success: true,
      message: 'Request received successfully',
      id: `tmp-${Date.now()}`,
      ...corsHeaders,
    })
  } catch (error) {
    console.error('Submission error:', error)
    return res.status(500).json({ error: 'Internal server error. Please try again later.', ...corsHeaders })
  }
}
