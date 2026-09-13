import { defineFunction, secret } from "@aws-amplify/backend";

export const IsSocialProcessor = defineFunction({
    name: "IsSocialProcessor",
    entry: "./handler.ts",
    timeoutSeconds: 900,
    environment: {
        THREADS_ACCESS_TOKEN: secret("THREADS_ACCESS_TOKEN"),
        X_API_KEY: secret("X_API_KEY"),
        X_API_KEY_SECRET: secret("X_API_KEY_SECRET"),
        X_ACCESS_TOKEN: secret("X_ACCESS_TOKEN"),
        X_ACCESS_SECRET: secret("X_ACCESS_SECRET"),
        X_BEARER_TOKEN: secret("X_BEARER_TOKEN"),
        GOOGLE_SHEETS_KEY_BASE64: secret("GOOGLE_SHEETS_KEY_BASE64")
    }
});
