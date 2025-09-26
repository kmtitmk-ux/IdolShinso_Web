import { defineFunction } from "@aws-amplify/backend";

export const envConfig = {
    main: {
        TABLE_NAME_IS_POSTS: "IsPosts-lwae74brlvfstbdkoxvvvdcofq-NONE",
        TABLE_NAME_IS_POSTMETA: "IsPostMeta-lwae74brlvfstbdkoxvvvdcofq-NONE",
        TABLE_NAME_IS_TERMS: "IsTerms-lwae74brlvfstbdkoxvvvdcofq-NONE",
        TABLE_NAME_IS_COMMENTS: "IsComments-lwae74brlvfstbdkoxvvvdcofq-NONE",
        BUCKET_NAME_IS_01: "amplify-dtb1zhx1jvcon-main-bran-is01bucketd5d9d3bb-pxrydzwv0aeo",
    },
    develop: {
        TABLE_NAME_IS_POSTS: "IsPosts-o4ipk765lnd2fm3ecrgqjnhbsq-NONE",
        TABLE_NAME_IS_POSTMETA: "IsPostMeta-o4ipk765lnd2fm3ecrgqjnhbsq-NONE",
        TABLE_NAME_IS_TERMS: "IsTerms-o4ipk765lnd2fm3ecrgqjnhbsq-NONE",
        TABLE_NAME_IS_COMMENTS: "IsComments-o4ipk765lnd2fm3ecrgqjnhbsq-NONE",
        BUCKET_NAME_IS_01: "amplify-dtb1zhx1jvcon-develop-b-is01bucketd5d9d3bb-evfat46goxx2"
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
        TABLE_NAME_IS_POSTS: process.env.TABLE_NAME_IS_POSTS ?? selectedConfig.TABLE_NAME_IS_POSTS,
        TABLE_NAME_IS_POSTMETA: process.env.TABLE_NAME_IS_POSTMETA ?? selectedConfig.TABLE_NAME_IS_POSTMETA,
        TABLE_NAME_IS_TERMS: process.env.TABLE_NAME_IS_TERMS ?? selectedConfig.TABLE_NAME_IS_TERMS,
        TABLE_NAME_IS_COMMENTS: process.env.TABLE_NAME_IS_COMMENTS ?? selectedConfig.TABLE_NAME_IS_COMMENTS,
        BUCKET_NAME_IS_01: process.env.BUCKET_NAME_IS_01 ?? selectedConfig.BUCKET_NAME_IS_01
    }
});