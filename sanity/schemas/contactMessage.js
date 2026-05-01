export default {
  name: 'contactMessage',
  title: 'Contact Messages',
  type: 'document',
  fields: [
    {
      name: 'name',
      title: 'Name',
      type: 'string',
      readOnly: true
    },
    {
      name: 'email',
      title: 'Email',
      type: 'string',
      readOnly: true
    },
    {
      name: 'subject',
      title: 'Subject',
      type: 'string',
      readOnly: true
    },
    {
      name: 'message',
      title: 'Message',
      type: 'text',
      readOnly: true
    },
    {
      name: 'receivedAt',
      title: 'Received At',
      type: 'datetime',
      readOnly: true
    },
    {
      name: 'read',
      title: 'Read',
      type: 'boolean',
      initialValue: false,
      description: 'Mark as read once you have replied.'
    },
    {
      name: 'notes',
      title: 'Internal Notes',
      type: 'text',
      description: 'Your private notes for this message.'
    }
  ],
  preview: {
    select: { name: 'name', email: 'email', subject: 'subject', read: 'read' },
    prepare({ name, email, subject, read }) {
      return {
        title: `${read ? '' : '● '}${name} — ${subject || '(no subject)'}`,
        subtitle: email
      }
    }
  },
  orderings: [
    {
      title: 'Newest First',
      name: 'receivedAtDesc',
      by: [{ field: 'receivedAt', direction: 'desc' }]
    },
    {
      title: 'Unread First',
      name: 'unreadFirst',
      by: [{ field: 'read', direction: 'asc' }, { field: 'receivedAt', direction: 'desc' }]
    }
  ]
}
