export default {
  name: 'siteSettings',
  title: 'Site Settings',
  type: 'document',
  __experimental_actions: ['update', 'publish'],
  fields: [
    {
      name: 'siteTitle',
      title: 'Site Title',
      type: 'string',
      initialValue: 'SYLHERA'
    },
    {
      name: 'logo',
      title: 'Logo',
      type: 'image',
      description: 'Replaces the default logo. Recommended: square, transparent background (PNG/SVG).',
      options: { hotspot: false }
    },
    {
      name: 'favicon',
      title: 'Favicon',
      type: 'image',
      description: 'Browser tab icon. Recommended: 32×32px or 64×64px PNG.',
      options: { hotspot: false }
    },
    {
      name: 'description',
      title: 'Site Description',
      type: 'text',
      rows: 2,
      description: 'Used for SEO meta description.'
    }
  ],
  preview: {
    prepare() {
      return { title: 'Site Settings' }
    }
  }
}
