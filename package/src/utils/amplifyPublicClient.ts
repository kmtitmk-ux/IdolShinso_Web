// utils/amplifyPublicClient.ts
import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import type { Schema } from "@/amplify/data/resource";
import outputs from "@/amplify_outputs.json";

Amplify.configure(outputs, { ssr: true });

export const publicClient = generateClient<Schema>({
    authMode: "iam", // または "apiKey"
});