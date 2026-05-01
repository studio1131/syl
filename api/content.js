// api/content.js — serves all CMS content to the frontend
import { createClient } from '@sanity/client'

const PROJECT_ID = process.env.SANITY_PROJECT_ID
const DATASET   = process.env.SANITY_DATASET || 'production'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')

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
    useCdn: true
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

      client.fetch(`*[_type == "track"] | order(order asc) {
        _id, title, trackNumber, genre, duration, dark,
        "audioUrl": audioFile.asset->url
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

    return res.status(200).json({ totems, posts, tracks, homepageImages, universeImages, siteSettings })
  } catch (error) {
    console.error('Content fetch error:', error)
    return res.status(500).json({ error: 'Failed to fetch content' })
  }
}
