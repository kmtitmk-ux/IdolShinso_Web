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
        X_USER_ID: "1981604542614794241",
        GOOGLE_SHEETS_KEY_BASE64: secret("GOOGLE_SHEETS_KEY_BASE64"),
        GOOGLE_SPREADSHEET_ID_SNS: "1nJ0RW0CadVS6P_fqAv4Psu9k1vwPIGe8Eou5iwfaYuA"
    }
});
