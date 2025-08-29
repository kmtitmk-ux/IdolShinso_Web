import { Grid, Typography } from '@mui/material';
import PageContainer from '@/app/(DashboardLayout)/components/container/PageContainer';
import DashboardCard from '@/app/(DashboardLayout)/components/shared/DashboardCard';
import { cookiesClient } from "@/utils/amplifyServerUtils";
import Image from "next/image";
import outputs from '@/amplify_outputs.json';
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);
const bucketName01 = outputs.storage.bucket_name; // package/amplify_outputs.json

interface PageProps {
    params: Promise<{ slug: string; }>; // paramsをPromiseでラップ
}
const SamplePage = async ({ params }: PageProps) => {

    const { slug } = await params;
    console.info("slug", slug);
    const { data } = await cookiesClient.models.IS01.list({
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
            "comments.header",
            "comments.content",
        ]
    });
    console.info("fetch data SamplePage:", data[0]);
    return (
        <PageContainer
            title={data[0].rewrittenTitle ?? "" as string}
            description="this is Sample page"
        >
            <DashboardCard title={data[0].rewrittenTitle ?? "" as string}>
                <Image
                    src={`https://${bucketName01}.s3.ap-northeast-1.amazonaws.com/${data[0].thumbnail as string}`}
                    alt={data[0].rewrittenTitle ?? "" as string}
                    width={400}
                    height={250}
                    style={{
                        width: '40%',
                        height: 'auto',
                        objectFit: 'cover'
                    }}
                />
                <Grid container spacing={3}>
                    {
                        data[0].comments && data[0].comments.map((comment) => (
                            <Grid key={comment.id} size={12}>
                                <div style={{ fontWeight: "bold" }}>{comment.header ?? ""}</div>
                                <div
                                    dangerouslySetInnerHTML={{
                                        __html: DOMPurify.sanitize(comment.content ?? "")
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

