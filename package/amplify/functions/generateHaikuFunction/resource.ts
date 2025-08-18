import { defineFunction } from "@aws-amplify/backend";

const envConfig = {
    main: {
        MODEL_ID: "anthropic.claude-3-haiku-20240307-v1:0",
    },
    develop: {
        MODEL_ID: "anthropic.claude-3-haiku-20240307-v1:0",
    },
    local: {
        MODEL_ID: "anthropic.claude-3-haiku-20240307-v1:0"
    }
};
type Branch = "main" | "develop";
const branch: Branch = (process.env.AWS_BRANCH as Branch) || "develop";
const selectedConfig = envConfig[branch] || envConfig.develop;

export const generateHaikuFunction = defineFunction({
    name: "generateHaikuFunction",
    entry: "./handler.ts",
    timeoutSeconds: 900,
    environment: {
        MODEL_ID: selectedConfig.MODEL_ID
    }
});

export const MODEL_ID = envConfig[branch].MODEL_ID;