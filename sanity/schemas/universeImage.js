export default {
  name: 'universeImage',
  title: 'Universe Images',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'caption',
      title: 'Caption',
      type: 'string',
      description: 'Short caption shown on hover.'
    },
    {
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
      validation: Rule => Rule.required()
    },
    {
      name: 'order',
      title: 'Display Order',
      type: 'number',
      description: 'Lower = appears first in the masonry grid.'
    }
  ],
  preview: {
    select: { title: 'title', media: 'image', caption: 'caption' },
    prepare({ title, media, caption }) {
      return { title, subtitle: caption, media }
    }
  },
  orderings: [
    { title: 'Display Order', name: 'orderAsc', by: [{ field: 'order', direction: 'asc' }] }
  ]
}
