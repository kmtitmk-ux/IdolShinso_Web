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
}
export async function generateMetadata({ params }: PageProps) {
    const { slug, lang } = await params;
    const slugTaxonomy = `${slug}_category`;
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
const Category = async ({ params }: PageProps) => {
    const { slug, lang } = await params;
    console.info("slug", decodeURIComponent(slug));
    const slugTaxonomy = `${decodeURIComponent(slug)}_category`;
    const { data, nextToken } = await cookiesClient.models.IsPostMeta.listIsPostMetaBySlugTaxonomyAndCreatedAt({
        slugTaxonomy,
    }, {
        limit: 8,
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
    // 翻訳データ取得
    const editData: any = [];
    for (const v of data) {
        const post = {
            ...v.post,
            postmeta: [{
                id: v.id,
                slug: v.slug,
                name: v.name
            }]
        };
        const { data } = await cookiesClient.models.IsPostsTranslations.listIsPostsTranslationsByPostId({
            postId: v.post.id
        }, {
            filter: { lang: { eq: lang } },
            selectionSet: ["rewrittenTitle"]
        });
        post.rewrittenTitle = data[0]?.rewrittenTitle ?? v.post.title;
        editData.push({ ...post });
    }
    return (
        <>
            <PageContainer title={data[0]?.name ?? ""} description="">
                <Box>
                    <Grid container spacing={3}>
                        <Blog
                            data={editData}
                            lang={lang}
                        />
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
