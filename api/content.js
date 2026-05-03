// api/content.js — serves all CMS content to the frontend
import { createClient } from '@sanity/client'
import { createHmac } from 'crypto'

const PROJECT_ID  = process.env.SANITY_PROJECT_ID
const DATASET     = process.env.SANITY_DATASET || 'production'
const SIGNING_KEY = process.env.AUDIO_SIGNING_SECRET || ''

// Generate a signed token valid for 30 minutes for a given track ID
function signAudioToken(id) {
  const expiry  = Math.floor(Date.now() / 1000) + 1800
  const payload = `${id}:${expiry}`
  if (!SIGNING_KEY) return null  // dev mode — no token needed
  const sig = createHmac('sha256', SIGNING_KEY).update(payload).digest('base64url')
  return Buffer.from(payload).toString('base64url') + '.' + sig
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!PROJECT_ID) {
    return res.status(200).json({
      totems: [], posts: [], tracks: [],
      homepageImages: [], universeImages: [], siteSettings: null
    })
  }

  const client = createClient({
    projectId: PROJECT_ID,
    dataset: DATASET,
    apiVersion: '2024-01-01',
    useCdn: false
  })

  try {
    const [totems, posts, tracks, homepageImages, universeImages, siteSettings] = await Promise.all([
      client.fetch(`*[_type == "totem" && available == true] | order(order asc) {
        _id, title, shortDescription, fullDescription, pricing, materials, edition, category,
        "imageUrl": mainImage.asset->url,
        "imageAlt": mainImage.alt
      }`),

      client.fetch(`*[_type == "blogPost"] | order(publishedAt desc) {
        _id, title, excerpt, tag, publishedAt,
        "imageUrl": mainImage.asset->url,
        body
      }`),

      // audioUrl intentionally omitted — served only through /api/audio proxy
      client.fetch(`*[_type == "track"] | order(order asc) {
        _id, title, trackNumber, genre, duration, dark
      }`),

      client.fetch(`*[_type == "homepageImage"] | order(order asc) {
        _id, title, tag, link,
        "imageUrl": image.asset->url
      }`),

      client.fetch(`*[_type == "universeImage"] | order(order asc) {
        _id, title, caption,
        "imageUrl": image.asset->url
      }`),

      client.fetch(`*[_type == "siteSettings"][0] {
        siteTitle,
        "logoUrl": logo.asset->url,
        "faviconUrl": favicon.asset->url,
        description
      }`)
    ])

    // Attach signed, expiring audio tokens to each track.
    // The actual CDN URL is never included — only /api/audio?id=...&t=... is used.
    const tracksWithTokens = tracks.map(t => ({
      ...t,
      token: signAudioToken(t._id)
    }))

    return res.status(200).json({
      totems, posts,
      tracks: tracksWithTokens,
      homepageImages, universeImages, siteSettings
    })
  } catch (error) {
    console.error('Content fetch error:', error)
    return res.status(500).json({ error: 'Failed to fetch content' })
  }
}
