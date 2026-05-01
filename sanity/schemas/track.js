export default {
  name: 'track',
  title: 'Tracks',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'trackNumber',
      title: 'Track Number',
      type: 'string',
      description: 'Display number, e.g. "01", "02"'
    },
    {
      name: 'genre',
      title: 'Genre',
      type: 'string',
      description: 'e.g. "Dark Ambient", "Experimental"'
    },
    {
      name: 'audioFile',
      title: 'Audio File',
      type: 'file',
      options: { accept: 'audio/*' },
      description: 'Upload MP3, WAV, or OGG. Max recommended: 20 MB.'
    },
    {
      name: 'duration',
      title: 'Duration (seconds)',
      type: 'number',
      description: 'Total length in seconds, e.g. 222 for 3:42.'
    },
    {
      name: 'dark',
      title: 'Dark Theme Card',
      type: 'boolean',
      initialValue: false,
      description: 'Display this track with a dark background.'
    },
    {
      name: 'order',
      title: 'Display Order',
      type: 'number',
      description: 'Lower = appears first.'
    }
  ],
  preview: {
    select: { title: 'title', genre: 'genre', number: 'trackNumber' },
    prepare({ title, genre, number }) {
      return { title: `${number || '—'} — ${title}`, subtitle: genre }
    }
  },
  orderings: [
    { title: 'Display Order', name: 'orderAsc', by: [{ field: 'order', direction: 'asc' }] }
  ]
}
