import { defineFunction } from "@aws-amplify/backend";

export const isSnsFunctionEnvConfig = {
    main: {
        TABLE_ID:"lwae74brlvfstbdkoxvvvdcofq-NONE",
        BUCKET_NAME_IS_01: "amplify-dtb1zhx1jvcon-main-bran-is01bucketd5d9d3bb-q8ierlcpxzjp",
    },
    develop: {
        TABLE_ID:"o4ipk765lnd2fm3ecrgqjnhbsq-NONE",
        BUCKET_NAME_IS_01: "amplify-dtb1zhx1jvcon-develop-b-is01bucketd5d9d3bb-evfat46goxx2"
    }
};
type Branch = "main" | "develop";
const branch: Branch = (process.env.AWS_BRANCH as Branch) || "develop";
const selectedConfig = isSnsFunctionEnvConfig[branch] || isSnsFunctionEnvConfig.develop;

export const isSnsFunction = defineFunction({
    name: "is-sns-function",
    entry: "./handler.ts",
    timeoutSeconds: 900,
    environment: {
        TABLE_ID: process.env.TABLE_ID ?? selectedConfig.TABLE_ID,
        BUCKET_NAME_IS_01: process.env.BUCKET_NAME_IS_01 ?? selectedConfig.BUCKET_NAME_IS_01
    }
});
