// api/submit-request.js
// Vercel Serverless Function for secure form submission

import { createClient } from '@sanity/client'

// Rate limiting using Vercel KV (optional but recommended)
const RATE_LIMIT = 5 // max requests per IP per hour
const rateLimit = new Map()

// Initialize Sanity client with environment variables
const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET || 'production',
  token: process.env.SANITY_WRITE_TOKEN, // Write token with create permissions
  apiVersion: '2024-01-01',
  useCdn: false
})

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Input sanitization
function sanitizeInput(input) {
  if (typeof input !== 'string') return ''
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000) // Limit length
}

// Rate limiting check
function checkRateLimit(ip) {
  const now = Date.now()
  const userRequests = rateLimit.get(ip) || []
  
  // Remove requests older than 1 hour
  const recentRequests = userRequests.filter(
    timestamp => now - timestamp < 3600000
  )
  
  if (recentRequests.length >= RATE_LIMIT) {
    return false
  }
  
  recentRequests.push(now)
  rateLimit.set(ip, recentRequests)
  return true
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({})
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      ...corsHeaders 
    })
  }

  try {
    // Get client IP for rate limiting
    const ip = req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.socket.remoteAddress

    // Check rate limit
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ 
        error: 'Too many requests. Please try again later.',
        ...corsHeaders 
      })
    }

    // Parse and validate input
    const { item, firstName, lastName, email, message } = req.body

    // Validation
    if (!item || !firstName || !lastName || !email) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        ...corsHeaders 
      })
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email address',
        ...corsHeaders 
      })
    }

    // Sanitize inputs
    const sanitizedData = {
      _type: 'totemRequest',
      item: sanitizeInput(item),
      firstName: sanitizeInput(firstName),
      lastName: sanitizeInput(lastName),
      email: sanitizeInput(email).toLowerCase(),
      message: sanitizeInput(message || ''),
      status: 'new',
      submittedAt: new Date().toISOString()
    }

    // Create document in Sanity
    const result = await client.create(sanitizedData)

    // Optional: Send notification email using a service like SendGrid
    // await sendNotificationEmail(sanitizedData)

    // Log submission (remove in production or use proper logging service)
    console.log('Request submitted:', {
      id: result._id,
      item: sanitizedData.item,
      email: sanitizedData.email,
      timestamp: sanitizedData.submittedAt
    })

    return res.status(200).json({ 
      success: true,
      message: 'Request submitted successfully',
      id: result._id,
      ...corsHeaders 
    })

  } catch (error) {
    console.error('Submission error:', error)
    
    return res.status(500).json({ 
      error: 'Internal server error. Please try again later.',
      ...corsHeaders 
    })
  }
}

// Optional: Email notification function
async function sendNotificationEmail(data) {
  // Example using SendGrid
  /*
  const sgMail = require('@sendgrid/mail')
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
  
  const msg = {
    to: process.env.NOTIFICATION_EMAIL,
    from: process.env.FROM_EMAIL,
    subject: `New Totem Request: ${data.item}`,
    text: `
      New request received:
      
      Item: ${data.item}
      From: ${data.firstName} ${data.lastName}
      Email: ${data.email}
      Message: ${data.message}
      
      Submitted at: ${data.submittedAt}
    `,
    html: `
      <h2>New Totem Request</h2>
      <p><strong>Item:</strong> ${data.item}</p>
      <p><strong>From:</strong> ${data.firstName} ${data.lastName}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Message:</strong> ${data.message}</p>
      <p><strong>Submitted:</strong> ${data.submittedAt}</p>
    `
  }
  
  await sgMail.send(msg)
  */
}
