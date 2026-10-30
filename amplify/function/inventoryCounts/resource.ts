import { defineFunction } from "@aws-amplify/backend";

export const inventoryCounts = defineFunction({
  name: "inventoryCounts",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  memoryMB: 512,
  resourceGroupName: "data",   
});