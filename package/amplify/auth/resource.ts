// amplify/auth/resource.ts
import { defineAuth, secret } from '@aws-amplify/backend';

const branch = (process.env.AWS_BRANCH ?? "sandbox").replaceAll(/[^a-zA-Z0-9-]/g, "-");

export const auth = defineAuth({
    name: `is-auth-${branch}`,
    loginWith: {
        email: {
            verificationEmailStyle: "CODE",
            verificationEmailSubject: "【アイドル深層】 メールアドレスの確認をお願いします",
            verificationEmailBody: (createCode: () => string) => `
ご登録ありがとうございます。

以下の確認コードを入力してください：
${createCode()}

このコードの有効期限は30分です。
`,
        },
        externalProviders: {
            google: {
                clientId: secret("GOOGLE_CLIENT_ID"),
                clientSecret: secret("GOOGLE_CLIENT_SECRET"),
                scopes: ["email", "profile"],
                attributeMapping: {
                    email: "email",
                    preferredUsername: "name",
                },
            },
            callbackUrls: ["http://localhost:3000/"],
            logoutUrls: ["http://localhost:3000/"],
        },
    },
    userAttributes: {
        preferredUsername: {
            required: true,
            mutable: true
        },
    },
});
