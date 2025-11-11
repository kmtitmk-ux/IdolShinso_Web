import { Grid, Box, Pagination, PaginationItem, Typography } from '@mui/material';
import PageContainer from '@/app/(DashboardLayout)/components/container/PageContainer';
// components
import Blog from '@/app/(DashboardLayout)/components/dashboard/Blog';
import NextPage from '@/app/(DashboardLayout)/components/container/NextPage';
import { cookiesClient } from "@/utils/amplifyServerUtils";

interface PageProps {
    params: Promise<{
        slug: string;
        lang: string;
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
    } else
        return {
            title: `Idol Shinsou | Discover the Latest About Your Favorite Idols`,
            description: `From live reports and member interviews to the latest news, Idol Shinsou delivers daily updates to make your fandom deeper. Covering everything from popular groups to rising stars, we bring you the latest on your favorite idols.`
        };
}
const Dashboard = async ({ params }: PageProps) => {
    const awaitedParams = await params;
    const { lang } = awaitedParams;
    const { data, nextToken, errors } = await cookiesClient.models.IsPosts.listIsPostsByStatusAndCreatedAt({
        status: "published"
    }, {
        sortDirection: "DESC",
        limit: 8,
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
    if (errors) {
        console.error(errors);
        return;
    }
    const editData = data.map((item) => {
        const postsTranslations = item.postsTranslations.filter((pm) => {
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
            rewrittenTitle: postsTranslations?.rewrittenTitle || item?.rewrittenTitle,
            thumbnail: item.thumbnail,
            createdAt: item.createdAt,
            postmeta: item.postmeta.filter(pm => pm.taxonomy === "category")
        };
    });
    console.log("Dashboard editData:", editData);
    return (
        <>
            <PageContainer title="Dashboard" description="this is Dashboard">
                <Box>
                    <Grid container spacing={3}>
                        <Blog data={editData} lang={lang} />
                        <NextPage token={nextToken ?? ""} queryType={""} pk="" lang={lang} />
                    </Grid>
                </Box>
            </PageContainer>
        </>
    );
};

export default Dashboard;
