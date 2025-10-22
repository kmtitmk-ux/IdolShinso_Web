"use client";
import React, { useEffect, useState, useRef } from "react";
import {
    Card,
    CardContent,
    CardMedia,
    Typography,
    Grid,
    CircularProgress,
    Container,
} from "@mui/material";
import { generateClient } from 'aws-amplify/data';
import Blog from '@/app/(DashboardLayout)/components/dashboard/Blog';
import type { Schema } from '@/amplify/data/resource';
const NextPage = ({
    token = null,
    queryType = "",
    pk = "",
    lang = ""
}: {
    token: string | null;
    queryType: string;
    pk: string;
    lang: string;
}) => {
    console.info("NextPage", queryType, pk, lang);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [nextToken, setNextToken] = useState<string | null>(token);
    const loader = useRef<HTMLDivElement | null>(null);
    const isFetching = useRef(false);
    const client = generateClient<Schema>();

    useEffect(() => {
        if (!loader.current) return;
        const currentLoader = loader.current;
        const observer = new IntersectionObserver((entries) => {
            const first = entries[0];
            if (first.isIntersecting && !loading && nextToken) {
                fetchData();
            }
        }, { threshold: 1 });
        observer.observe(currentLoader);
        return () => {
            if (currentLoader) observer.unobserve(currentLoader);
        };
    }, [nextToken]);

    const fetchData = async () => {
        if (isFetching.current || !nextToken) return;
        isFetching.current = true;
        setLoading(true);
        let res: {
            data?: any[];
            nextToken?: string | null;
        } = {};
        try {
            switch (queryType) {
                case "category":
                    console.log(pk);
                    res = await client.models.IsPostMeta.listIsPostMetaBySlugTaxonomyAndCreatedAt({
                        slugTaxonomy: pk
                    }, {
                        sortDirection: "DESC",
                        limit: 8,
                        nextToken: nextToken,
                        selectionSet: [
                            "post.id",
                            "post.slug",
                            "post.status",
                            "post.title",
                            "post.rewrittenTitle",
                            "post.thumbnail",
                            "post.createdAt",
                            "id",
                            "slug",
                            "name"
                        ]
                    });
                    console.log("category editData", pk, res);

                    // 翻訳データ取得
                    const editData: any = [];
                    for (const v of res.data ?? []) {
                        const post = {
                            ...v.post,
                            postmeta: [{
                                id: v.id,
                                slug: v.slug,
                                name: v.name
                            }]
                        };
                        const { data } = await client.models.IsPostsTranslations.listIsPostsTranslationsByPostId({
                            postId: v.post.id
                        }, {
                            filter: { lang: { eq: lang } },
                            selectionSet: ["rewrittenTitle"]
                        });
                        post.rewrittenTitle = data[0]?.rewrittenTitle ?? v.post.title;
                        editData.push({ ...post });
                    }
                    setItems((prev) => [...prev, ...editData]);
                    setNextToken(res?.nextToken ?? null);
                    break;
                default:
                    res = await client.models.IsPosts.listIsPostsByStatusAndCreatedAt({
                        status: "published"
                    }, {
                        sortDirection: "DESC",
                        limit: 8,
                        nextToken: nextToken,
                        selectionSet: [
                            "id",
                            "slug",
                            "title",
                            "rewrittenTitle",
                            "thumbnail",
                            "createdAt",
                            "postmeta.id",
                            "postmeta.slug",
                            "postmeta.name",
                            "postmeta.taxonomy",
                            "postsTranslations.lang",
                            "postsTranslations.rewrittenTitle"
                        ],
                    });
                    res.data = (res.data ?? []).map((item: any) => {
                        const postsTranslations = (item?.postsTranslations ?? []).filter((pm: any) => {
                            if (lang !== "ja") {
                                return pm.lang === lang;
                            } else {
                                return false;
                            }
                        })[0];
                        return {
                            id: item.id,
                            slug: item.slug,
                            title: item.title,
                            rewrittenTitle: postsTranslations?.rewrittenTitle ?? item?.rewrittenTitle,
                            thumbnail: item.thumbnail,
                            createdAt: item.createdAt,
                            postmeta: item.postmeta.filter((pm: any) => {
                                return pm.taxonomy === "category";
                            })
                        };
                    });
            }
            setItems((prev) => [...prev, ...(res?.data ?? [])]);
            setNextToken(res?.nextToken ?? null);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
        isFetching.current = false;
    };

    return (
        <>
            {loading && (
                <Grid container justifyContent="center" sx={{ mt: 2 }}>
                    <CircularProgress />
                </Grid>
            )}
            <Blog data={items} lang={lang} />
            <div ref={loader} style={{ height: "40px" }} />
        </>
    );
};

export default NextPage;
