import Link from "next/link";
import { Grid, Box, Button } from "@mui/material";
import { getPostsByDateRange, getTranslations } from "@/utils/cachedQueries";

export const revalidate = 60;

import PageContainer from '@/app/(DashboardLayout)/components/container/PageContainer';
import NextPage from '@/app/(DashboardLayout)/components/container/NextPage';
import Blog from '@/app/(DashboardLayout)/components/dashboard/Blog';
import dayjs from "dayjs";
import Prev from "@/app/(DashboardLayout)/components/container/Prev";

interface PageProps {
    params: Promise<{
        year: string;
        lang: string;
    }>;
    searchParams: Promise<{
        token?: string;
    }>;
}

export async function generateMetadata({ params }: PageProps) {
    const { year } = await params;
    return {
        title: `${year}年の記事一覧｜アイドル深層`,
        description: `${year}年の記事一覧。最新ニュース、ライブレポート、メンバーインタビューまで網羅した記事一覧を「アイドル深層」で公開中。今すぐチェックして、推し活をもっと濃くしよう。`
    };
}
const YearArchive = async ({ params, searchParams }: any) => {
    const { year, lang } = await params;
    const { token } = await searchParams;
    const startYear = dayjs(`${year}-01-01`).startOf('year').toISOString();
    const endYear = dayjs(`${year}-01-01`).endOf('year').toISOString();
    const { listData, nextToken, pk } = await getPostsByDateRange(startYear, endYear, token ?? null);
    const translationsResults = lang === "ja"
        ? listData.map(() => ({ data: [] as { rewrittenTitle?: string }[] }))
        : await getTranslations(listData.map((v: any) => v.id), lang);
    const editData = listData.map((v: any, i: number) => {
        const imageUrl = v.thumbnail ? `https://${process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN}/${v.thumbnail}` : "";
        return {
            id: v.id,
            slug: v.slug,
            title: v.title,
            rewrittenTitle: translationsResults[i].data[0]?.rewrittenTitle ?? v?.rewrittenTitle ?? "",
            thumbnail: v?.thumbnail ?? "",
            imageUrl,
            createdAt: v?.createdAt ?? "",
            postmeta: [{ id: v?.id ?? "", slug: v.slug, name: v.name }]
        };
    });
    return (
        <>
            <PageContainer title={listData[0]?.name ?? ""} description="">
                <Box>
                    <Grid container spacing={3}>
                        <Blog data={editData} lang={lang} />
                        {!token && <NextPage token={nextToken ?? ""} queryType={"date"} pk={pk} lang={lang} />}
                    </Grid>
                    <Grid container justifyContent="space-between">
                        <Grid>
                            {token && <Prev />}
                        </Grid>
                        <Grid>
                            {nextToken && <Button component={Link} href={`?token=${nextToken}`}>次のページ</Button>}
                        </Grid>
                    </Grid>
                </Box>
            </PageContainer>
        </>
    );
};

export default YearArchive;
