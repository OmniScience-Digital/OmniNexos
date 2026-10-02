export const baseUrl = "http://localhost:5001/api/v1";
// export const securebaseUrlprod = "https://unb298qh1g.execute-api.us-east-2.amazonaws.com/api/v1";
export const securebaseUrltest ="https://wq3qo9l3de.execute-api.us-east-1.amazonaws.com/api/v1";
export const securebaseUrlProd ="https://apqirzaiib.execute-api.us-east-1.amazonaws.com/api/v1";
// Read from the build environment (set in Amplify Hosting's Environment
// variables, and in a local .env.local for dev) instead of being committed to
// source. This does not stop the token from being visible in the built JS
// bundle — a token used directly from the browser is always extractable by
// anyone who opens devtools — but it keeps it out of git history going
// forward, lets it be rotated without a code change, and lets each
// environment (test/prod) use its own token if you choose to split them.
// See VITE_CLICKUP_API_TOKEN in Amplify Hosting's build settings.
export const API_TOKEN = import.meta.env.VITE_CLICKUP_API_TOKEN ?? '';
if (!API_TOKEN && import.meta.env.DEV) {
  console.warn(
    "VITE_CLICKUP_API_TOKEN is not set. Add it to a .env.local file for local development.",
  );
}
//main
//export const VIF_LIST_ID = '901213458480';
//test
export const VIF_LIST_ID = '901214245527';
export const USERNAME_FIELD_ID = 'daf6f996-8096-473b-b9e4-9e20f4568d63';
export const SERVICE_FIELD_ID = '70b7bb17-88b8-44ed-9df3-2ab192e5619a';
export const TYRE_FIELD_ID = 'df6d9886-035c-49fd-aeed-527d8c63903d';
export const REVIEW_FIELD_ID = 'f50b49c1-7fdc-41c7-b0eb-be31c78361e6';

