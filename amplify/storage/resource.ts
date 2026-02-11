// amplify/storage.ts
import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'inspectionStorage',
  access: (allow) => ({
    "inspections/*": [
      // Explicitly specify the group
      allow.groups(["USERS"]).to(['read', 'write', 'delete']),
      allow.groups(["ADMINS"]).to(['read', 'write', 'delete']),
      allow.guest.to(['read'])
    ],
    "documents/*": [
      allow.groups(["USERS"]).to(['read', 'write', 'delete']),
      allow.groups(["ADMINS"]).to(['read', 'write', 'delete']),
      allow.guest.to(['read'])
    ],
    "hr/*": [
      allow.groups(["USERS"]).to(['read', 'write', 'delete']),
      allow.groups(["ADMINS"]).to(['read', 'write', 'delete']),
      allow.guest.to(['read'])
    ],
  })
});