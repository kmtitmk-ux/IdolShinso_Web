import { defineFunction } from "@aws-amplify/backend";
const envConfig = {
    main: {
        TABLE_NAME_IS01: "IS01-2w6gn26ifzccdn6xdivunqamhu-NONE",
        TABLE_NAME_IS02: "IS02-2w6gn26ifzccdn6xdivunqamhu-NONE",
        TABLE_NAME_IS03: "IS03-2w6gn26ifzccdn6xdivunqamhu-NONE",
        BUCKET_NAME_IS01: "amplify-dtb1zhx1jvcon-main-bran-is01bucketd5d9d3bb-pxrydzwv0aeo"
    },
    develop: {
        TABLE_NAME_IS01: "IS01-o4ipk765lnd2fm3ecrgqjnhbsq-NONE",
        TABLE_NAME_IS02: "IS02-o4ipk765lnd2fm3ecrgqjnhbsq-NONE",
        TABLE_NAME_IS03: "IS03-o4ipk765lnd2fm3ecrgqjnhbsq-NONE",
        BUCKET_NAME_IS01: "amplify-dtb1zhx1jvcon-develop-b-is01bucketd5d9d3bb-xytrkowiqmzx"
    },
    local: {
        TABLE_NAME_IS01: "IS01-lwae74brlvfstbdkoxvvvdcofq-NONE",
        TABLE_NAME_IS02: "IS02-lwae74brlvfstbdkoxvvvdcofq-NONE",
        TABLE_NAME_IS03: "IS03-lwae74brlvfstbdkoxvvvdcofq-NONE",
        BUCKET_NAME_IS01: "amplify-modernizenextfree-kmtit-is01bucketd5d9d3bb-8lyst8isl15o"
    }
};
type Branch = "main" | "develop";
const branch: Branch = (process.env.AWS_BRANCH as Branch) || "develop";
const selectedConfig = envConfig[branch] || envConfig.develop;

export const myFirstFunction = defineFunction({
    name: "my-first-function",
    entry: "./handler.ts",
    timeoutSeconds: 900,
    environment: {
        TABLE_NAME_IS01: selectedConfig.TABLE_NAME_IS01,
        TABLE_NAME_IS02: selectedConfig.TABLE_NAME_IS02,
        TABLE_NAME_IS03: selectedConfig.TABLE_NAME_IS03,
        BUCKET_NAME_IS01: selectedConfig.BUCKET_NAME_IS01
    }
});