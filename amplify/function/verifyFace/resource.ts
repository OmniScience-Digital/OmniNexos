import { defineFunction } from "@aws-amplify/backend";

export const verifyFace = defineFunction({
  name: "verify-face-lambda",
  resourceGroupName: "storage",
});