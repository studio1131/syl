// sanity/schemas/totemRequest.js
export default {
  name: 'totemRequest',
  title: 'Totem Requests',
  type: 'document',
  fields: [
    {
      name: 'item',
      title: 'Item Requested',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'firstName',
      title: 'First Name',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'lastName',
      title: 'Last Name',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'email',
      title: 'Email Address',
      type: 'string',
      validation: Rule => Rule.required().email()
    },
    {
      name: 'message',
      title: 'Message',
      type: 'text'
    },
    {
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          {title: 'New', value: 'new'},
          {title: 'In Progress', value: 'inProgress'},
          {title: 'Completed', value: 'completed'},
          {title: 'Cancelled', value: 'cancelled'}
        ],
        layout: 'radio'
      },
      initialValue: 'new'
    },
    {
      name: 'submittedAt',
      title: 'Submitted At',
      type: 'datetime',
      validation: Rule => Rule.required()
    },
    {
      name: 'notes',
      title: 'Internal Notes',
      type: 'text',
      description: 'Private notes for internal use'
    }
  ],
  preview: {
    select: {
      title: 'item',
      subtitle: 'email',
      status: 'status'
    },
    prepare(selection) {
      const {title, subtitle, status} = selection
      return {
        title: `${title} - ${subtitle}`,
        subtitle: `Status: ${status}`
      }
    }
  },
  orderings: [
    {
      title: 'Submitted Date, Newest',
      name: 'submittedAtDesc',
      by: [
        {field: 'submittedAt', direction: 'desc'}
      ]
    },
    {
      title: 'Status',
      name: 'statusAsc',
      by: [
        {field: 'status', direction: 'asc'}
      ]
    }
  ]
}
