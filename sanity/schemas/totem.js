// sanity/schemas/totem.js
export default {
  name: 'totem',
  title: 'Totems',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96
      },
      validation: Rule => Rule.required()
    },
    {
      name: 'shortDescription',
      title: 'Short Description',
      type: 'text',
      rows: 2,
      validation: Rule => Rule.required().max(150)
    },
    {
      name: 'fullDescription',
      title: 'Full Description',
      type: 'text',
      rows: 5,
      validation: Rule => Rule.required()
    },
    {
      name: 'mainImage',
      title: 'Main Image',
      type: 'image',
      options: {
        hotspot: true
      },
      validation: Rule => Rule.required(),
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alternative text',
          validation: Rule => Rule.required()
        }
      ]
    },
    {
      name: 'gallery',
      title: 'Image Gallery',
      type: 'array',
      of: [
        {
          type: 'image',
          options: {
            hotspot: true
          },
          fields: [
            {
              name: 'alt',
              type: 'string',
              title: 'Alternative text'
            }
          ]
        }
      ]
    },
    {
      name: 'pricing',
      title: 'Pricing',
      type: 'string',
      initialValue: 'On Request',
      validation: Rule => Rule.required()
    },
    {
      name: 'available',
      title: 'Available',
      type: 'boolean',
      description: 'Is this item currently available?',
      initialValue: true
    },
    {
      name: 'edition',
      title: 'Edition Info',
      type: 'object',
      fields: [
        {
          name: 'type',
          title: 'Edition Type',
          type: 'string',
          options: {
            list: [
              {title: 'One of a Kind', value: 'unique'},
              {title: 'Limited Edition', value: 'limited'},
              {title: 'Open Edition', value: 'open'}
            ]
          }
        },
        {
          name: 'totalPieces',
          title: 'Total Pieces',
          type: 'number',
          description: 'For limited editions'
        },
        {
          name: 'remaining',
          title: 'Pieces Remaining',
          type: 'number',
          description: 'For limited editions'
        }
      ]
    },
    {
      name: 'materials',
      title: 'Materials',
      type: 'array',
      of: [{type: 'string'}],
      description: 'List of materials used'
    },
    {
      name: 'dimensions',
      title: 'Dimensions',
      type: 'object',
      fields: [
        {
          name: 'width',
          title: 'Width (cm)',
          type: 'number'
        },
        {
          name: 'height',
          title: 'Height (cm)',
          type: 'number'
        },
        {
          name: 'depth',
          title: 'Depth (cm)',
          type: 'number'
        },
        {
          name: 'weight',
          title: 'Weight (g)',
          type: 'number'
        }
      ]
    },
    {
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          {title: 'Mirrors & Scrying', value: 'mirrors'},
          {title: 'Jewelry & Talismans', value: 'jewelry'},
          {title: 'Sound Objects', value: 'sound'},
          {title: 'Incense & Ritual', value: 'ritual'},
          {title: 'Textile & Cloth', value: 'textile'},
          {title: 'Sculpture', value: 'sculpture'}
        ]
      }
    },
    {
      name: 'order',
      title: 'Display Order',
      type: 'number',
      description: 'Lower numbers appear first'
    }
  ],
  preview: {
    select: {
      title: 'title',
      media: 'mainImage',
      available: 'available'
    },
    prepare(selection) {
      const {title, media, available} = selection
      return {
        title: title,
        subtitle: available ? 'Available' : 'Sold Out',
        media: media
      }
    }
  },
  orderings: [
    {
      title: 'Display Order',
      name: 'orderAsc',
      by: [
        {field: 'order', direction: 'asc'}
      ]
    },
    {
      title: 'Title A-Z',
      name: 'titleAsc',
      by: [
        {field: 'title', direction: 'asc'}
      ]
    }
  ]
}
