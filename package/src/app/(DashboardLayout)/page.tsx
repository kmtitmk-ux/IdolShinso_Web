import Link from 'next/link';
import { Grid, Box, Pagination, PaginationItem } from '@mui/material';
import PageContainer from '@/app/(DashboardLayout)/components/container/PageContainer';
// components
import SalesOverview from '@/app/(DashboardLayout)/components/dashboard/SalesOverview';
import YearlyBreakup from '@/app/(DashboardLayout)/components/dashboard/YearlyBreakup';
import RecentTransactions from '@/app/(DashboardLayout)/components/dashboard/RecentTransactions';
import ProductPerformance from '@/app/(DashboardLayout)/components/dashboard/ProductPerformance';
import Blog from '@/app/(DashboardLayout)/components/dashboard/Blog';
import MonthlyEarnings from '@/app/(DashboardLayout)/components/dashboard/MonthlyEarnings';
import { downloadData } from 'aws-amplify/storage';

const Dashboard = async ({ searchParams }: { searchParams: { page?: string; }; }) => {
    const params = await searchParams;
    const currentPage = Number(params.page) || 1;
    const downloadResult = await downloadData({ path: "public/pagenation.json" }).result;
    const text = await downloadResult.body.text();
    const pagenation = JSON.parse(text);
    console.info("pageSize:", currentPage);
    const totalPages = Object.keys(pagenation).length;
    const nextToken = pagenation[currentPage];
    console.info("nextToken:", nextToken);

    const ServerPagination = () => {
        return (
            <nav aria-label="Page navigation">
                <ul style={{ display: "flex", gap: "8px", listStyle: "none", padding: 0 }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <li key={page}>
                            <Link
                                href={`?page=${page}`}
                                style={{
                                    padding: "6px 12px",
                                    border: "1px solid #ccc",
                                    borderRadius: "4px",
                                    textDecoration: "none",
                                    background: page === currentPage ? "#1976d2" : "#fff",
                                    color: page === currentPage ? "#fff" : "#000",
                                }}
                            >
                                {page}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
        );
    };

    return (
        <>
            <PageContainer title="Dashboard" description="this is Dashboard">
                <Box>
                    <Grid container spacing={3}>
                        <Blog searchParams={params} nextToken={nextToken} />
                    </Grid>
                    <ServerPagination />
                </Box>
            </PageContainer>
        </>
    );
};

export default Dashboard;
