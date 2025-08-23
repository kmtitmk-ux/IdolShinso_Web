import { Grid, Typography } from '@mui/material';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import PageContainer from '@/app/(DashboardLayout)/components/container/PageContainer';
import DashboardCard from '@/app/(DashboardLayout)/components/shared/DashboardCard';
import { serverClient } from "@/utils/serverClient";

const { window } = new JSDOM('');
const purify = DOMPurify(window);

const SamplePage = async ({ slug }: { slug: string; }) => {
    const { data } = await serverClient.models.IS01.list({
        filter: {
            slug: { eq: slug }
        },
        selectionSet: [
            "id",
            "slug",
            "title",
            "rewrittenTitle",
            "thumbnail",
            "createdAt",
            "categories.id",
            "categories.name",
            "comments.id",
            // "comments.header",
            "comments.content",
        ]
    });
    console.info("fetch data:", data[0]);
    return (
        <PageContainer
            title={data[0].rewrittenTitle ?? "" as string}
            description="this is Sample page">
            <DashboardCard title={data[0].rewrittenTitle ?? "" as string}>
                {/* <Typography>{data[0].rewrittenTitle}</Typography> */}
                <Grid container spacing={3}>
                    {
                        data[0].comments?.map((comment) => (
                            <Grid key={comment.id}>
                                <Typography variant="h6">110:   2025/08/13(水) 17:34:31.03 0</Typography>
                                <Typography
                                    variant="body1"
                                    dangerouslySetInnerHTML={{
                                        __html: purify.sanitize(comment.content ?? "")
                                    }}
                                />
                            </Grid>
                        ))
                    }
                </Grid>
            </DashboardCard>
        </PageContainer>
    );
};

export default SamplePage;

