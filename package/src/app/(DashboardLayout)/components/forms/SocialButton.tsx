"use client";

import { Button } from "@mui/material";
import { signInWithRedirect } from "aws-amplify/auth";
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/../amplify/data/resource';

const client = generateClient<Schema>({
    authMode: 'userPool'
});

export default function GoogleSignInButton({ redirect = "/" }: { redirect?: string }) {
    const handleSignIn = async () => {
        try {
            await signInWithRedirect({ provider: "Google", customState: redirect });
            // console.info('[confirmSignUp] creating DB record', userId);
            // const res = await client.models.IsUsers.create({
            //     userId,
            //     email,
            //     plan: "free",
            //     createdAt: new Date().toISOString(),
            //     role: "user"
            // });
            // console.info('[confirmSignUp] DB record created', res);
        } catch (error) {
            console.error("Google ログインエラー:", error);
        }
    };

    return (
        <Button
            variant="outlined"
            fullWidth
            onClick={handleSignIn}
            startIcon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
                    <path
                        fill="#EA4335"
                        d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.104C18.311 2.059 15.49.5 12.24.5 5.866.5.68 5.648.68 12s5.186 11.5 11.56 11.5c6.656 0 11.085-4.646 11.085-11.238 0-.756-.08-1.332-.178-1.977H12.24z"
                    />
                </svg>
            }
            sx={{
                py: 1.5,
                color: "text.primary",
                borderColor: "divider",
                backgroundColor: "background.paper",
                textTransform: "none", // 大文字強制（GOOGLE DE TUDUKERU）を無効化
                fontSize: "1rem",
                fontWeight: 600,
                borderRadius: 2, // 8px
                boxShadow: 1,
                "&:hover": {
                    backgroundColor: "action.hover",
                    borderColor: "text.secondary",
                },
            }}
        >
            Google で続ける
        </Button>
    );
}
