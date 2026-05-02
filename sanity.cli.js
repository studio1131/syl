import { defineCliConfig } from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'hnattvpc',
    dataset: 'production'
  },
  studioHost: 'sylhera',
  deployment: {
    appId: 'oc7t5rcqe115rno4h6heisti',
  },
})
