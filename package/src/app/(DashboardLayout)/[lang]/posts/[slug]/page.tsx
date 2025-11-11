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
const bucketName01 = outputs?.storage?.bucket_name ?? ""; // package/amplify_outputs.json

interface PageProps {
    params: Promise<{
        slug: string;
        lang: string;
    }>;
}
export async function generateMetadata({ params }: PageProps) {
    const awaitedParams = await params;
    const { lang, slug } = awaitedParams;
    const { data } = await cookiesClient.models.IsPosts.listIsPostsBySlug({
        slug: decodeURIComponent(slug)
    }, {
        selectionSet: [
            "id",
            "title",
            "rewrittenTitle",
            "thumbnail"
        ]
    });
    const id = data[0]?.id as string;
    const siteTitle = lang === "ja" ? "アイドル深層" : lang === "en" ? "Idol Shinsou" : "偶像深層";
    const locale = lang === "ja" ? "ja_JP" : lang === "en" ? "en_US" : "zh-TW";
    const thumbnail = data[0].thumbnail;
    let title = data[0].rewrittenTitle || data[0].title;
    let description = data[0].rewrittenTitle || data[0].title;
    if (lang !== "ja") {
        const { data: translationsData } = await cookiesClient.models.IsPostsTranslations.listIsPostsTranslationsByPostId(
            { postId: id },
            {
                filter: { lang: { eq: lang } },
                selectionSet: [
                    "id",
                    "rewrittenTitle",
                    "content",
                ]
            }
        );
        title = translationsData[0]?.rewrittenTitle || title;
        description = translationsData[0]?.rewrittenTitle || description;
    }
    return {
        title: `${title} | ${siteTitle}`,
        description: `${description}。${siteTitle}`,
        openGraph: {
            title: title,
            description: description,
            url: `https://geinouwasa.com/posts/${slug}`,
            siteName: siteTitle,
            images: [
                {
                    url: `https://${bucketName01}.s3.ap-northeast-1.amazonaws.com/${thumbnail}`,
                    width: 1200,
                    height: 630,
                    alt: title,
                },
            ],
            locale,
            type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title: title,
            description: description,
            images: [`https://${bucketName01}.s3.ap-northeast-1.amazonaws.com/${thumbnail}`],
            creator: '@IdolShinso',
        },
    };
}
const SamplePage = async ({ params }: PageProps) => {
    const awaitedParams = await params;
    const { lang, slug } = awaitedParams;
    const { data: postData } = await cookiesClient.models.IsPosts.listIsPostsBySlug(
        { slug: decodeURIComponent(slug) },
        {
            selectionSet: [
                "id",
                "slug",
                "title",
                "rewrittenTitle",
                "thumbnail",
                "content",
                "createdAt",
                "postmeta.id",
                "postmeta.name",
                "postsTranslations.lang",
                "postsTranslations.rewrittenTitle"
            ]
        });
    const postsTranslations = postData[0].postsTranslations.filter((pm) => pm.lang === lang)[0];
    const postId = postData[0]?.id as string;
    const { data: commentsData } = await cookiesClient.models.IsComments.listIsCommentsByPostIdAndCreatedAt(
        { postId },
        {
            selectionSet: [
                "id",
                "createdAt",
                "header",
                "content",
            ]
        });
    const data = { ...postData[0], comments: commentsData ?? [] };
    console.info("fetch data postData:", postData);
    console.info("fetch data commentsData:", commentsData);
    const title = postsTranslations?.rewrittenTitle || data.rewrittenTitle || "";
    return (
        <PageContainer
            title={title}
            description="this is Sample page"
        >
            <DashboardCard title={title}>
                {/* <Image
                    src={`https://${bucketName01}.s3.ap-northeast-1.amazonaws.com/${data.thumbnail as string}`}
                    alt={title}
                    width={400}
                    height={250}
                    style={{
                        width: '40%',
                        height: 'auto',
                        objectFit: 'cover'
                    }
                    }
                /> */}
                <div
                    dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(data.content ?? "")
                    }}
                />
                < Grid container spacing={3} mt={2} >
                    {
                        data.comments && data.comments.map((comment) => (
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
                </Grid >
            </DashboardCard >
        </PageContainer >
    );
};

export default SamplePage;

