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
    params: Promise<{ slug: string; }>; // paramsをPromiseでラップ
}
const Category = async ({ params }: PageProps) => {
    const { slug } = await params;
    console.info("slug", decodeURIComponent(slug));
    const { data, nextToken } = await cookiesClient.models.IsPostMeta.listIsPostMetaBySlugAndTaxonomy({
        slug: decodeURIComponent(slug),
        taxonomy: { eq: "category" }
    }, {
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
    const editData = data.map((item) => {
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
    console.info("fetch data category:", editData);
    return (
        <>
            <PageContainer title={data[0].name ?? ""} description="">
                <Box>
                    <Grid container spacing={3}>
                        <Blog data={editData} />
                        <NextPage
                            token={nextToken ?? ""}
                            queryType={"category"}
                            pk={slug}
                        />
                    </Grid>
                </Box>
            </PageContainer>
        </>
    );
};

export default Category;
