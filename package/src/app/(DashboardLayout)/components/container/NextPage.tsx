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
const NextPage = ({ token = null, queryType = "", pk = "" }: { token: string | null; queryType: string; pk: string; }) => {
    console.info("NextPage", queryType, pk);
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
                    res = await client.models.IsPostMeta.listIsPostMetaBySlugAndTaxonomy({
                        slug: pk,
                        taxonomy: { eq: "category" }
                    }, {
                        nextToken: nextToken,
                        selectionSet: [
                            "post.id",
                            "post.slug",
                            "post.title",
                            "post.rewrittenTitle",
                            "post.thumbnail",
                            "post.createdAt",
                            "id",
                            "slug",
                            "name"
                        ]
                    });
                    res.data = res?.data ?? [].map((item: any) => {
                        const outParam = {
                            ...item.post,
                            postmeta: [{
                                id: item.id,
                                slug: item.slug,
                                name: item.name
                            }]
                        };
                        return outParam;
                    });
                    break;
                default:
                    res = await client.models.IsPosts.list({
                        nextToken: nextToken,
                        limit: 1,
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
                            "postmeta.taxonomy"
                        ]
                    });
                    res.data = (res.data ?? []).map((item: any) => {
                        return {
                            id: item.id,
                            slug: item.slug,
                            title: item.title,
                            rewrittenTitle: item.rewrittenTitle,
                            thumbnail: item.thumbnail,
                            createdAt: item.createdAt,
                            postmeta: item.postmeta.filter((pm: any) => {
                                return pm.taxonomy === "category";
                            })
                        };
                    });
            }
            console.log("fetch NextPage", res?.data);
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
            <Blog data={items} />
            <div ref={loader} style={{ height: "40px" }} />
        </>
    );
};

export default NextPage;
