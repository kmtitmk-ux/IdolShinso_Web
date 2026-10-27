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
    slug,
}: {
    post: any;
    slug: string;
}) {
    const { id: postId, visibility } = post ?? {};
    const { dbUser, loading } = useDbUser();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [excerpt, setExcerpt] = useState<string | null>(post?.excerpt ?? null);
    const [content, setContent] = useState<string | null>(post?.content ?? null);
    const [fetching, setFetching] = useState(false);
    const [paying, setPaying] = useState(false);
    const [purchased, setPurchased] = useState(false);

    useEffect(() => {
        if (!dbUser || !postId) return;
        setFetching(true);
        const hasSessionId = !!searchParams.get('session_id');
        const checkPurchase = async (): Promise<boolean> => {
            const { data: purchases } = await client.models.IsPurchases.get({ userId: dbUser.id, postId });
            return !!purchases;
        };

        const fetchAll = async () => {
            if (visibility === "paid") {
                let isPurchased = await checkPurchase();
                if (!isPurchased && hasSessionId) {
                    // webhookの反映を最大10秒待つ
                    for (let i = 0; i < 5 && !isPurchased; i++) {
                        await new Promise(r => setTimeout(r, 2000));
                        isPurchased = await checkPurchase();
                    }
                }
                if (!isPurchased) {
                    setContent("");
                    return;
                }
                setExcerpt("");
                setPurchased(true);
            }
        };

        fetchAll().finally(() => setFetching(false));
    }, [dbUser, slug, postId, visibility]);

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
                    <Box sx={{ textAlign: "left" }}>
                        <div dangerouslySetInnerHTML={{ __html: excerpt ?? "" }} />
                    </Box>
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
                    <Box sx={{ textAlign: "left" }}>
                        <div dangerouslySetInnerHTML={{ __html: excerpt ?? "" }} />
                    </Box>
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

    return <div dangerouslySetInnerHTML={{ __html: content ?? "" }} />;
}
