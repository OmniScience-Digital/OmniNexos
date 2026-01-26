import { defineAuth, secret } from "@aws-amplify/backend";

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret("GOOGLE_CLIENT_ID"),
        clientSecret: secret("GOOGLE_SECRET"),
        scopes: ["profile", "email"],
        attributeMapping: {
          email: "email",
          preferredUsername: "name"
        },
      },
      callbackUrls: [
        "http://localhost:5173/landing",

      ],
      logoutUrls: [
        "http://localhost:5173/",

      ],
    },
  },
});
