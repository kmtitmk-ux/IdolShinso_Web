import Link from 'next/link';
import { Grid, Box, Pagination, PaginationItem, Typography } from '@mui/material';
import PageContainer from '@/app/(DashboardLayout)/components/container/PageContainer';
// components
import SalesOverview from '@/app/(DashboardLayout)/components/dashboard/SalesOverview';
import YearlyBreakup from '@/app/(DashboardLayout)/components/dashboard/YearlyBreakup';
import RecentTransactions from '@/app/(DashboardLayout)/components/dashboard/RecentTransactions';
import ProductPerformance from '@/app/(DashboardLayout)/components/dashboard/ProductPerformance';
import Blog from '@/app/(DashboardLayout)/components/dashboard/Blog';
import NextPage from '@/app/(DashboardLayout)/components/container/NextPage';
import MonthlyEarnings from '@/app/(DashboardLayout)/components/dashboard/MonthlyEarnings';
import { downloadData } from 'aws-amplify/storage';
import { cookiesClient } from "@/utils/amplifyServerUtils";
export async function generateMetadata() {
    return {
        title: `アイドル深層｜推しの“今”を深く知る、アイドル情報メディア`,
        description: `ライブレポート、メンバーインタビュー、最新ニュースまで──「アイドル深層」は、あなたの推し活をもっと濃くする情報を毎日更新。人気グループから注目の新星まで、アイドルの“今”を深層まで届けます。`
    };
}
const Dashboard = async () => {
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
            "postmeta.taxonomy"
        ],
    });
    if (errors) {
        console.error(errors);
        return;
    }
    const editData = data.map((item) => {
        return {
            id: item.id,
            slug: item.slug,
            title: item.title,
            rewrittenTitle: item.rewrittenTitle,
            thumbnail: item.thumbnail,
            createdAt: item.createdAt,
            postmeta: item.postmeta.filter(pm => pm.taxonomy === "category")
        };
    });
    console.info("fetched data:", editData);

    return (
        <>
            <PageContainer title="Dashboard" description="this is Dashboard">
                <Box>
                    <Grid container spacing={3}>
                        <Blog data={editData} />
                        <NextPage token={nextToken ?? ""} queryType={""} pk="" />
                    </Grid>
                </Box>
            </PageContainer>
        </>
    );
};

export default Dashboard;
