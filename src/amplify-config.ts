// src/amplify-config.ts
//
// The single place Amplify is configured. Import this file first (for its
// side effect) anywhere that needs Amplify to be configured before use.
// ES modules evaluate once, so configure() runs exactly once.
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";

Amplify.configure(outputs);