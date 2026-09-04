import { defineFunction } from "@aws-amplify/backend";
type Branch = "main" | "develop";
const branch: Branch = (process.env.AWS_BRANCH as Branch) || "develop";

export const myFirstFunction = defineFunction({
    name: "my-first-function",
    entry: "./handler.ts",
    timeoutSeconds: 900,
});
