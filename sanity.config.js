import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './sanity/schemas/index.js'

export default defineConfig({
  name: 'sylhera',
  title: 'Sylhera Studio',

  projectId: process.env.SANITY_STUDIO_PROJECT_ID || 'hnattvpc',
  dataset: process.env.SANITY_STUDIO_DATASET || 'production',

  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Sylhera CMS')
          .items([
            S.listItem()
              .title('Site Settings')
              .id('siteSettings')
              .child(
                S.document()
                  .schemaType('siteSettings')
                  .documentId('siteSettings')
              ),
            S.divider(),
            S.listItem()
              .title('Homepage Images')
              .schemaType('homepageImage')
              .child(S.documentTypeList('homepageImage').title('Homepage Images')),
            S.listItem()
              .title('Universe Images')
              .schemaType('universeImage')
              .child(S.documentTypeList('universeImage').title('Universe Images')),
            S.divider(),
            S.documentTypeListItem('track').title('Tracks — Playground'),
            S.documentTypeListItem('blogPost').title('Blog Posts — Fragments'),
            S.documentTypeListItem('totem').title('Totems'),
            S.divider(),
            S.documentTypeListItem('contactMessage').title('Contact Messages'),
            S.documentTypeListItem('totemRequest').title('Totem Requests'),
          ])
    }),
    visionTool()
  ],

  schema: {
    types: schemaTypes
  }
})
