import Link from "next/link";
import { useParams } from "next/navigation";
import {
    CardContent,
    Button,
    Typography,
    Rating,
    Tooltip,
    Fab,
    Avatar,
    Grid,
    Box,
    Pagination,
    PaginationItem
} from "@mui/material";
import { cookiesClient } from "@/utils/amplifyServerUtils";

// components
import PageContainer from '@/app/(DashboardLayout)/components/container/PageContainer';
import SalesOverview from '@/app/(DashboardLayout)/components/dashboard/SalesOverview';
import YearlyBreakup from '@/app/(DashboardLayout)/components/dashboard/YearlyBreakup';
import RecentTransactions from '@/app/(DashboardLayout)/components/dashboard/RecentTransactions';
import ProductPerformance from '@/app/(DashboardLayout)/components/dashboard/ProductPerformance';
import NextPage from '@/app/(DashboardLayout)/components/container/NextPage';
import Blog from '@/app/(DashboardLayout)/components/dashboard/Blog';
import MonthlyEarnings from '@/app/(DashboardLayout)/components/dashboard/MonthlyEarnings';
import { downloadData } from 'aws-amplify/storage';
import BlankCard from "@/app/(DashboardLayout)/components/shared/BlankCard";
import { Stack } from "@mui/system";
import dayjs from 'dayjs';
import Image from "next/image";
import outputs from '@/amplify_outputs.json';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

interface PageProps {
    params: Promise<{
        slug: string;
        lang: string;
    }>;
    taxonomy: undefined | "category" | "tags";
}
export async function generateMetadata({ params, taxonomy = "category" }: PageProps) {
    const { slug, lang } = await params;
    const slugTaxonomy = `${slug}_${taxonomy}`;
    const { data } = await cookiesClient.models.IsPostMeta.listIsPostMetaBySlugTaxonomyAndCreatedAt({
        slugTaxonomy,
    }, {
        selectionSet: [
            "post.thumbnail",
            "name"
        ]
    });
    return {
        title: `${data[0]?.name}の魅力を深層まで探る｜アイドル深層`,
        description: `【${data[0]?.name}】の魅力をもっと深く知りたいあなたへ。最新ニュース、ライブレポート、メンバーインタビューまで網羅した記事一覧を「アイドル深層」で公開中。今すぐチェックして、推し活をもっと濃くしよう。`
    };
}
const Category = async ({ params, taxonomy = "category" }: PageProps) => {
    const { slug, lang } = await params;
    console.info("slug", decodeURIComponent(slug));
    const slugTaxonomy = `${decodeURIComponent(slug)}_${taxonomy}`;
    let nextToken: string | null = null;
    let listData: any = [];
    const selectionSet = [
        "post.id",
        "post.slug",
        "post.title",
        "post.rewrittenTitle",
        "post.thumbnail",
        "post.createdAt",
        "id",
        "slug",
        "name"
    ] as const;
    let listParams = {
        limit: 8,
        selectionSet,
        nextToken: null as string | null
    };
    do {
        const { data, nextToken: newNextToken } = await cookiesClient.models.IsPostMeta
            .listIsPostMetaBySlugTaxonomyAndCreatedAt({ slugTaxonomy }, listParams);
        const filterData = data.filter(v => v.post != null);
        listData = [...listData, ...filterData];
        if (newNextToken) listParams.nextToken = nextToken = newNextToken;
        if (!newNextToken || listData.length >= listParams.limit) break;
    } while (true);

    // 翻訳データ取得
    const editData: any = [];
    for (const v of listData) {
        if (v.post) {
            const post: {
                id: string;
                slug: string;
                title: string;
                rewrittenTitle?: string;
                thumbnail?: string;
                createdAt?: string;
                postmeta: {
                    id: string;
                    slug: string;
                    name: string;
                }[];
            } = {
                id: v.post.id,
                slug: v.post.slug,
                title: v.post.title,
                rewrittenTitle: v.post?.rewrittenTitle ?? "",
                thumbnail: v.post?.thumbnail ?? "",
                createdAt: v.post?.createdAt ?? "",
                postmeta: [{
                    id: v?.id ?? "",
                    slug: v.slug,
                    name: v.name
                }]
            };
            const { data: translationsData } = await cookiesClient.models.IsPostsTranslations.listIsPostsTranslationsByPostId({
                postId: post?.id
            }, {
                filter: { lang: { eq: lang } },
                selectionSet: ["rewrittenTitle"]
            });
            if (translationsData?.length) post.rewrittenTitle = translationsData[0]?.rewrittenTitle ?? "";
            editData.push({ ...post });
        }
    }
    return (
        <>
            <PageContainer title={listData[0]?.name ?? ""} description="">
                <Box>
                    <Grid container spacing={3}>
                        {editData.length ? <Blog data={editData} lang={lang} /> : ""}
                        <NextPage
                            token={nextToken ?? ""}
                            queryType={"category"}
                            pk={slugTaxonomy}
                            lang={lang}
                        />
                    </Grid>
                </Box>
            </PageContainer>
        </>
    );
};

export default Category;
