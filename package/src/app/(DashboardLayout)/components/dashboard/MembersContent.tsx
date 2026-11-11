"use client";

import { useEffect, useState } from "react";
import { Box, Button, Typography, Link, CircularProgress } from "@mui/material";
import { useDbUser } from "@/app/(DashboardLayout)/components/forms/AuthSync";
import { usePathname, useSearchParams } from "next/navigation";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/../amplify/data/resource";

const client = generateClient<Schema>({ authMode: "userPool" });

export default function MembersContent({
    post,
}: {
    post: any;
}) {
    const { id: postId, visibility } = post ?? {};
    const { dbUser, loading } = useDbUser();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [excerpt, setExcerpt] = useState<string | null>(post?.excerpt ?? null);
    const [content, setContent] = useState<string>("");
    const [fetching, setFetching] = useState(false);
    const [paying, setPaying] = useState(false);
    const [purchased, setPurchased] = useState(false);

    useEffect(() => {
        if (!dbUser?.id || !postId) return;

        // アンマウント・依存値の変更時に、古い処理の結果を捨てるためのフラグ
        let cancelled = false;
        setFetching(true);

        // Stripe決済直後のリダイレクトかどうか（?session_id=... が付いている）
        const hasSessionId = !!searchParams.get('session_id');

        // 購入済みかどうかをDBで確認する
        const checkPurchase = async (): Promise<boolean> => {
            const { data } = await client.models.IsPurchases.get({
                userId: dbUser.id,
                postId,
            });
            return !!data;
        };

        // 記事本文を取得して state に反映する
        const fetchContent = async () => {
            const { data: post } = await client.models.IsPosts.get(
                { id: postId },
                { selectionSet: ["content"] },
            );
            // 取得中にキャンセルされていたら state を更新しない
            if (cancelled) return;
            setExcerpt("");
            setContent(post?.content ?? "");
        };

        const fetchAll = async () => {
            if (visibility === "paid") {
                // 有料記事: まず購入済みか確認
                let isPurchased = await checkPurchase();

                // 決済直後はwebhookの反映が遅れることがあるため、
                // 2秒間隔で最大5回（=最大10秒）ポーリングして待つ
                if (!isPurchased && hasSessionId) {
                    for (let i = 0; i < 5 && !isPurchased && !cancelled; i++) {
                        await new Promise(r => setTimeout(r, 2000));
                        isPurchased = await checkPurchase();
                    }
                }

                // キャンセル済み、または未購入なら本文は取得しない
                if (cancelled || !isPurchased) return;
                setPurchased(true);
                await fetchContent();
            } else if (visibility === "members") {
                await fetchContent();
            }
        };

        fetchAll()
            // 失敗してもUIが固まらないよう、ここでエラーを握る
            .catch(err => console.error("failed to fetch post content", err))
            // 成功・失敗・早期returnのいずれでもローディングを解除する
            .finally(() => {
                if (!cancelled) setFetching(false);
            });

        // クリーンアップ: 進行中の処理が完了しても state を更新させない
        return () => {
            cancelled = true;
        };
    }, [dbUser?.id, postId, visibility, searchParams]);

    if (loading || fetching) return <CircularProgress sx={{ mt: 3 }} />;

    const handlePurchase = async () => {
        if (!postId) return;
        setPaying(true);
        try {
            const { data: url } = await client.mutations.IsFunctionPayment({ productId: postId });
            if (url) window.location.href = url;
        } finally {
            setPaying(false);
        }
    };

    if (!dbUser) {
        const redirectParam = encodeURIComponent(pathname);
        return (
            <>
                {excerpt && (
                    <Box
                        sx={{
                            '& h1': { fontSize: '1.8rem !important', fontWeight: 'bold', my: 2.5 },
                            '& h2': { fontSize: '1.5rem !important', fontWeight: 'bold', my: 2 },
                            '& h3': { fontSize: '1.2rem !important', fontWeight: 'bold', my: 1.5 },
                            '& p': { lineHeight: 1.8, my: 1.5 },
                            '& a': { color: 'primary.main', textDecoration: 'underline' },
                            '& img': { maxWidth: '100%', height: 'auto' },
                        }}
                        dangerouslySetInnerHTML={{ __html: excerpt ?? "" }}
                    />
                )}
                <Box sx={{ mt: 3, p: 3, textAlign: "center", borderTop: 1, borderColor: "divider" }}>
                    <Typography sx={{ mb: 2 }}>
                        {visibility === "paid"
                            ? "この記事の続きは購入者限定です。"
                            : "この記事の続きは会員限定です。"}
                    </Typography>
                    <Button variant="contained" href={`/authentication/register?redirect=${redirectParam}`}>
                        新規登録して続きを読む
                    </Button>
                    <Typography variant="body2" sx={{ mt: 2, color: "text.secondary" }}>
                        すでにアカウントをお持ちの方は{" "}
                        <Link href={`/authentication/login?redirect=${redirectParam}`} underline="hover">
                            こちらからログイン
                        </Link>
                    </Typography>
                </Box>
            </>
        );
    }

    if (visibility === "paid" && !purchased) {
        return (
            <>
                {excerpt && (
                    <Box
                        sx={{
                            '& h1': { fontSize: '1.8rem !important', fontWeight: 'bold', my: 2.5 },
                            '& h2': { fontSize: '1.5rem !important', fontWeight: 'bold', my: 2 },
                            '& h3': { fontSize: '1.2rem !important', fontWeight: 'bold', my: 1.5 },
                            '& p': { lineHeight: 1.8, my: 1.5 },
                            '& a': { color: 'primary.main', textDecoration: 'underline' },
                            '& img': { maxWidth: '100%', height: 'auto' },
                        }}
                        dangerouslySetInnerHTML={{ __html: excerpt ?? "" }}
                    />
                )}
                <Box sx={{ mt: 3, p: 3, textAlign: "center", borderTop: 1, borderColor: "divider" }}>
                    <Typography sx={{ mb: 2 }}>この記事の続きは購入者限定です。</Typography>
                    <Button variant="contained" onClick={handlePurchase} disabled={paying}>
                        {paying ? <CircularProgress size={20} /> : "購入して続きを読む"}
                    </Button>
                </Box>
            </>
        );
    }

    return (
        <Box
            sx={{
                '& h1': { fontSize: '1.8rem !important', fontWeight: 'bold', my: 2.5 },
                '& h2': { fontSize: '1.5rem !important', fontWeight: 'bold', my: 2 },
                '& h3': { fontSize: '1.2rem !important', fontWeight: 'bold', my: 1.5 },
                '& p': { lineHeight: 1.8, my: 1.5 },
                '& a': { color: 'primary.main', textDecoration: 'underline' },
                '& img': { maxWidth: '100%', height: 'auto' },
            }}
            dangerouslySetInnerHTML={{ __html: content ?? "" }}
        />
    );
}
