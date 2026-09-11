import Link from "next/link";
import { Grid, Box, Button } from '@mui/material';
import PageContainer from '@/app/(DashboardLayout)/components/container/PageContainer';
import Blog from '@/app/(DashboardLayout)/components/dashboard/Blog';
import NextPage from '@/app/(DashboardLayout)/components/container/NextPage';
import Prev from "@/app/(DashboardLayout)/components/container/Prev";
import { getPostsByStatus } from "@/utils/cachedQueries";

export const revalidate = 60;


interface PageProps {
    params: Promise<{
        slug: string;
        lang: string;
    }>;
    searchParams: Promise<{
        token?: string;
    }>;
}
export async function generateMetadata({ params }: PageProps) {
    const awaitedParams = await params;
    const { lang } = awaitedParams;
    if (lang === "ja") {
        return {
            title: `アイドル深層 | 推しの最新情報を発見しよう`,
            description: `ライブレポートやメンバーインタビューから最新ニュースまで、アイドル深層はあなたの推し活をもっと濃くするために毎日更新中。人気グループから注目の新人まで、あなたの好きなアイドルの最新情報をお届けします。`
        };
    } else {
        return {
            title: `Idol Shinsou | Discover the Latest About Your Favorite Idols`,
            description: `From live reports and member interviews to the latest news, Idol Shinsou delivers daily updates to make your fandom deeper. Covering everything from popular groups to rising stars, we bring you the latest on your favorite idols.`
        };
    }
}
const Dashboard = async ({ params, searchParams }: PageProps) => {
    const awaitedParams = await params;
    const { lang } = awaitedParams;
    const { token } = await searchParams;
    const { data, nextToken, errors } = await getPostsByStatus(token ?? null);
    if (errors) {
        console.error(errors);
        return;
    }
    const editData = await Promise.all(data.map(async (item) => {
        const postsTranslations = item.postsTranslations.filter((pm) => {
            if (lang !== "ja") {
                return pm.lang === lang;
            } else {
                return false;
            }
        })[0];
        const imageUrl = item.thumbnail ? `https://${process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN}/${item.thumbnail}` : "";
        return {
            id: item.id,
            slug: item.slug,
            title: item.title,
            rewrittenTitle: postsTranslations?.rewrittenTitle || item?.rewrittenTitle,
            thumbnail: item.thumbnail,
            imageUrl,
            createdAt: item.createdAt,
            postmeta: item.postmeta.filter(pm => pm.taxonomy === "category")
        };
    }));
    return (
        <>
            <PageContainer title="Dashboard" description="this is Dashboard">
                <Box>
                    <Grid container spacing={1}>
                        <Blog data={editData} lang={lang} />
                        {!token && <NextPage token={nextToken ?? ""} queryType={""} lang={lang} />}
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

export default Dashboard;
