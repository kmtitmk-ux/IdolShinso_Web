import Link from "next/link";
import { Grid, Box, Button } from "@mui/material";
import { cookiesClient, runWithAmplifyServerContext } from "@/utils/amplifyServerUtils";

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
    let nextToken: string | null = null;
    let listData: any = [];
    const selectionSet = [
        "id",
        "slug",
        "title",
        "rewrittenTitle",
        "thumbnail",
        "createdAt",
    ] as const;
    const listParams = {
        limit: 8,
        selectionSet,
        nextToken: token ?? null as string | null,
        sortDirection: "DESC" as const,
    };
    const pk = {
        status: "published",
        createdAt: { between: [startYear, endYear] as [string, string] }
    };
    do {
        const { data, nextToken: newNextToken } = await cookiesClient.models.IsPosts.listIsPostsByStatusAndCreatedAt(pk, listParams);
        listData = [...listData, ...data];
        listParams.nextToken = nextToken = newNextToken ?? "";
        if (!newNextToken || listData.length >= listParams.limit) break;
    } while (true);
    const editData: any = [];
    for (const v of listData) {
        if (!v) continue;
        const { data: translationsData } = await cookiesClient.models.IsPostsTranslations.listIsPostsTranslationsByPostId({
            postId: v.id
        }, {
            filter: { lang: { eq: lang } },
            selectionSet: ["rewrittenTitle"]
        });
        const imageUrl = v.thumbnail ? `https://${process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN}/${v.thumbnail}` : "";
        editData.push({
            id: v.id,
            slug: v.slug,
            title: v.title,
            rewrittenTitle: translationsData[0]?.rewrittenTitle ?? v?.rewrittenTitle ?? "",
            thumbnail: v?.thumbnail ?? "",
            imageUrl,
            createdAt: v?.createdAt ?? "",
            postmeta: [{ id: v?.id ?? "", slug: v.slug, name: v.name }]
        });
    }
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
