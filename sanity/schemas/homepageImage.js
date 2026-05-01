export default {
  name: 'homepageImage',
  title: 'Homepage Images',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'tag',
      title: 'Tag',
      type: 'string',
      description: 'Short label shown on the image (e.g. "Visual", "Sound")',
      validation: Rule => Rule.required()
    },
    {
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
      validation: Rule => Rule.required()
    },
    {
      name: 'link',
      title: 'Navigate To',
      type: 'string',
      description: 'Page opened when visitor clicks this cell.',
      options: {
        list: [
          { title: 'Universe', value: 'universe' },
          { title: 'Playground', value: 'play' },
          { title: 'Fragments', value: 'articles' },
          { title: 'Totems', value: 'shop' },
          { title: 'About', value: 'about' }
        ]
      }
    },
    {
      name: 'order',
      title: 'Display Order',
      type: 'number',
      description: 'Lower = appears first (grid has 8 cells).'
    }
  ],
  preview: {
    select: { title: 'title', media: 'image', tag: 'tag' },
    prepare({ title, media, tag }) {
      return { title, subtitle: tag, media }
    }
  },
  orderings: [
    { title: 'Display Order', name: 'orderAsc', by: [{ field: 'order', direction: 'asc' }] }
  ]
}
