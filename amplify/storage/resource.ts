// amplify/storage.ts
import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'inspectionStorage',
  access: (allow) => ({
    // For inspection images - organized by vehicle reg and date
    "inspections/*": [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.guest.to(['read', 'write'])
    ],
    // For break and lux test PDFs
    "documents/*": [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.guest.to(['read', 'write'])
    ],
    "hr/*": [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.guest.to(['read', 'write'])
    ],

  })
});


