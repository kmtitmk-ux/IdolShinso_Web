import { defineFunction } from "@aws-amplify/backend";
const envConfig = {
    main: {
        TABLE_NAME_IS01: "IS01-2w6gn26ifzccdn6xdivunqamhu-NONE",
        TABLE_NAME_IS02: "IS02-2w6gn26ifzccdn6xdivunqamhu-NONE",
        TABLE_NAME_IS03: "IS03-2w6gn26ifzccdn6xdivunqamhu-NONE"
    },
    develop: {
        TABLE_NAME_IS01: "IS01-o4ipk765lnd2fm3ecrgqjnhbsq-NONE",
        TABLE_NAME_IS02: "IS02-o4ipk765lnd2fm3ecrgqjnhbsq-NONE",
        TABLE_NAME_IS03: "IS03-o4ipk765lnd2fm3ecrgqjnhbsq-NONE"
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
        TABLE_NAME_IS03: selectedConfig.TABLE_NAME_IS03
    }
});