import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { autoSignIn, signUp, confirmSignUp, resendSignUpCode } from "aws-amplify/auth";
import { Alert, Box, Typography, Button } from '@mui/material';
import CustomTextField from '@/app/(DashboardLayout)/components/forms/theme-elements/CustomTextField';
import { Stack } from '@mui/system';
import GoogleSignInButton from "@/app/(DashboardLayout)/components/forms/SocialButton";
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/../amplify/data/resource';

const client = generateClient<Schema>({
    authMode: 'userPool'
});

interface registerType {
    title?: string;
    subtitle?: React.ReactNode;
    subtext?: React.ReactNode;
    redirect?: string;
}

type Step = "signUp" | "confirm";

const AuthRegister = ({ title, subtitle, subtext, redirect = "/" }: registerType) => {
    const router = useRouter();
    const [step, setStep] = useState<Step>("signUp");
    const [preferredUsername, setPreferredUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const [loading, setLoading] = useState(false);

    const errorMessage = (err: unknown) => {
        const name = err instanceof Error ? err.name : "";
        switch (name) {
            case "UsernameExistsException":
                return "このメールアドレスは既に登録されています。";
            case "InvalidPasswordException":
                return "パスワードがポリシーを満たしていません。";
            case "InvalidParameterException":
                return err instanceof Error ? err.message : "入力内容が正しくありません。";
            case "CodeMismatchException":
                return "確認コードが正しくありません。";
            case "ExpiredCodeException":
                return "確認コードの有効期限が切れています。再送してください。";
            case "LimitExceededException":
                return "試行回数が多すぎます。しばらくしてからお試しください。";
            default:
                return err instanceof Error ? err.message : "エラーが発生しました。";
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setInfo("");
        setLoading(true);
        try {
            const trimmedName = preferredUsername.trim();
            const { nextStep } = await signUp({
                username: email.trim(),
                password,
                options: {
                    userAttributes: {
                        email: email.trim(),
                        ...(trimmedName && { preferred_username: trimmedName }),
                    },
                    autoSignIn: true,
                },
            });

            if (nextStep.signUpStep === "CONFIRM_SIGN_UP") {
                setStep("confirm");
                setInfo(`${email.trim()} に確認コードを送信しました。`);
            } else {
                window.location.href = `/authentication/login?redirect=${encodeURIComponent(redirect)}`;
            }
        } catch (err) {
            console.warn(err);
            setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setInfo("");
        setLoading(true);
        try {
            const { nextStep } = await confirmSignUp({
                username: email.trim(),
                confirmationCode: code.trim(),
            });
            // email: string, code: string, userId: string
            if (nextStep.signUpStep === "COMPLETE_AUTO_SIGN_IN") {
                const { isSignedIn } = await autoSignIn();
                // console.info('[confirmSignUp] creating DB record', userId);
                // const res = await client.models.IsUsers.create({
                //     userId,
                //     email,
                //     plan: "free",
                //     createdAt: new Date().toISOString(),
                //     role: "user"
                // });
                // console.info('[confirmSignUp] DB record created', res);
                window.location.href = isSignedIn
                    ? redirect
                    : `/authentication/login?redirect=${encodeURIComponent(redirect)}`;
            } else {
                window.location.href = `/authentication/login?redirect=${encodeURIComponent(redirect)}`;
            }
        } catch (err) {
            console.warn(err);
            setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setError("");
        setInfo("");
        try {
            await resendSignUpCode({ username: email.trim() });
            setInfo("確認コードを再送しました。");
        } catch (err) {
            setError(errorMessage(err));
        }
    };

    const alerts = (
        <>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {info && <Alert severity="info" sx={{ mb: 2 }}>{info}</Alert>}
        </>
    );

    const label = (text: string, htmlFor: string) => (
        <Typography
            variant="subtitle1"
            fontWeight={600}
            component="label"
            htmlFor={htmlFor}
            mb="5px"
        >
            {text}
        </Typography>
    );

    return (
        <>
            {title ? (
                <Typography fontWeight="700" variant="h2" mb={1}>
                    {title}
                </Typography>
            ) : null}

            {subtext}

            {step === "signUp" ? (
                <Box component="form" onSubmit={handleSignUp}>
                    {alerts}

                    {/* Google ログインボタン */}
                    <GoogleSignInButton redirect={redirect} />

                    {/* 👇 ここに区切り線を追加するとデザインが引き締まります */}
                    <Box sx={{ display: 'flex', alignItems: 'center', my: 3 }}>
                        <Box sx={{ flexGrow: 1, borderBottom: '1px solid', borderColor: 'divider' }} />
                        <Typography variant="body2" sx={{ px: 2, color: 'text.secondary' }}>
                            またはメールアドレスで登録
                        </Typography>
                        <Box sx={{ flexGrow: 1, borderBottom: '1px solid', borderColor: 'divider' }} />
                    </Box>

                    <Stack mb={3}>
                        <Box mt="25px">
                            {label("名前", "preferred_username")}
                            <CustomTextField
                                id="preferred_username"
                                variant="outlined"
                                fullWidth
                                value={preferredUsername}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPreferredUsername(e.target.value)}
                                autoComplete="nickname"
                            />
                        </Box>
                        <Box mt="25px">
                            {label("メールアドレス", "email")}
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
                            {label("パスワード", "password")}
                            <CustomTextField
                                id="password"
                                type="password"
                                variant="outlined"
                                fullWidth
                                value={password}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                        </Box>
                    </Stack>
                    <Button
                        color="primary"
                        variant="contained"
                        size="large"
                        fullWidth
                        type="submit"
                        disabled={loading || !email || !password}
                    >
                        {loading ? "Signing up..." : "Sign Up"}
                    </Button>
                </Box>
            ) : (
                <Box component="form" onSubmit={handleConfirm}>
                    {alerts}
                    <Stack mb={3}>
                        {label("確認コード", "code")}
                        <CustomTextField
                            id="code"
                            variant="outlined"
                            fullWidth
                            value={code}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value)}
                            autoComplete="one-time-code"
                        />
                    </Stack>
                    <Button
                        color="primary"
                        variant="contained"
                        size="large"
                        fullWidth
                        type="submit"
                        disabled={loading || !code}
                    >
                        {loading ? "確認中..." : "確認する"}
                    </Button>
                    <Button fullWidth sx={{ mt: 1 }} onClick={handleResend}>
                        コードを再送する
                    </Button>
                </Box>
            )}

            {subtitle}
        </>
    );
};

export default AuthRegister;
