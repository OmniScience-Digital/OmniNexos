// amplify/function/listTechnicians/resource.ts  (NEW FILE)
import { defineFunction } from "@aws-amplify/backend";

export const listTechnicians = defineFunction({
  name: "list-technicians",
  resourceGroupName: "auth",
});