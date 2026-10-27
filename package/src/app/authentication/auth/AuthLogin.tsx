"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "aws-amplify/auth";
import { Alert, Box, Typography, Button, Stack } from "@mui/material";
import CustomTextField from "@/app/(DashboardLayout)/components/forms/theme-elements/CustomTextField";
import GoogleSignInButton from "@/app/(DashboardLayout)/components/forms/SocialButton";

interface loginType {
    title?: string;
    subtitle?: React.ReactNode;
    subtext?: React.ReactNode;
    redirect?: string;
}

const AuthLogin = ({ title, subtitle, subtext, redirect = "/" }: loginType) => {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const { isSignedIn, nextStep } = await signIn({
                username: email.trim().toLowerCase(),
                password,
            });
            if (isSignedIn) {
                window.location.href = redirect;
                return;
            }
            switch (nextStep.signInStep) {
                case "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED":
                    setError("初回ログインのため、新しいパスワードの設定が必要です。");
                    break;
                case "CONFIRM_SIGN_UP":
                    setError("メールアドレスの確認が完了していません。登録時に届いた確認コードで認証してください。");
                    break;
                default:
                    setError(`追加の認証が必要です: ${nextStep.signInStep}`);
            }
        } catch (err) {
            const name = err instanceof Error ? err.name : "";
            if (name === "NotAuthorizedException" || name === "UserNotFoundException") {
                setError("メールアドレスまたはパスワードが正しくありません。");
            } else if (name === "UserAlreadyAuthenticatedException") {
                window.location.href = redirect;
            } else {
                console.warn(err);
                setError(err instanceof Error ? err.message : "ログインに失敗しました。");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box component="form" onSubmit={handleSubmit}>

            {title ? (
                <Typography fontWeight="700" variant="h2" mb={1}>
                    {title}
                </Typography>
            ) : null}

            {subtext}

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <Stack>

                {/* Google ログインボタン */}
                <GoogleSignInButton redirect={redirect} />

                {/* 👇 ここに区切り線を追加するとデザインが引き締まります */}
                <Box sx={{ display: 'flex', alignItems: 'center', my: 3 }}>
                    <Box sx={{ flexGrow: 1, borderBottom: '1px solid', borderColor: 'divider' }} />
                    <Typography variant="body2" sx={{ px: 2, color: 'text.secondary' }}>
                        またはメールアドレスでログイン
                    </Typography>
                    <Box sx={{ flexGrow: 1, borderBottom: '1px solid', borderColor: 'divider' }} />
                </Box>
                <Box>
                    <Typography
                        variant="subtitle1"
                        fontWeight={600}
                        component="label"
                        htmlFor="email"
                        mb="5px"
                    >
                        メールアドレス
                    </Typography>
                    <CustomTextField
                        id="email"
                        type="email"
                        variant="outlined"
                        fullWidth
                        value={email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}

                        autoComplete="email"
                    />
                </Box>
                <Box mt="25px">
                    <Typography
                        variant="subtitle1"
                        fontWeight={600}
                        component="label"
                        htmlFor="password"
                        mb="5px"
                    >
                        パスワード
                    </Typography>
                    <CustomTextField
                        id="password"
                        type="password"
                        variant="outlined"
                        fullWidth
                        value={password}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                        autoComplete="current-password"
                    />
                </Box>
            </Stack>
            <Box mt={3}>
                <Button
                    color="primary"
                    variant="contained"
                    size="large"
                    fullWidth
                    type="submit"
                    disabled={loading || !email || !password}

                >
                    {loading ? "Signing in..." : "Sign In"}
                </Button>
            </Box>
            {subtitle}
        </Box>
    );
};

export default AuthLogin;
