import Link from "next/link";
import { Box, Grid, Typography, Breadcrumbs, List, ListItem, ListItemText } from '@mui/material';
import PageContainer from '@/app/(DashboardLayout)/components/container/PageContainer';
import DashboardCard from '@/app/(DashboardLayout)/components/shared/DashboardCard';
import { cookiesClient } from "@/utils/amplifyServerUtils";
import Image from "next/image";
import outputs from '@/amplify_outputs.json';
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import Blog from '@/app/(DashboardLayout)/components/dashboard/Blog';
import { post } from "aws-amplify/api";
// import from '@mui/material/Breadcrumbs';
// import Link from '@mui/material/Link';
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
            images: [{
                url: `https://${bucketName01}.s3.ap-northeast-1.amazonaws.com/${thumbnail}`,
                width: 1200,
                height: 630,
                alt: title,
            }],
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
                "postmeta.slug",
                "postmeta.taxonomy",
                "postsTranslations.lang",
                "postsTranslations.rewrittenTitle",
                "postsTranslations.content"
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
    const content = postsTranslations?.content || data.content || "";
    const BreadcrumbSetter = ({ title, category }: { title: string; category: { slug: string; name: string; }; }) => {
        return (
            <Breadcrumbs
                aria-label="breadcrumb"
                sx={{ mb: 2 }}
            >
                {(() => {
                    const homeText = lang === "ja" ? "ホーム" : lang === "en" ? "Home" : "首頁";
                    const homeLink = lang === "ja" ? `/` : `/${lang}`;
                    const categoryLink = lang === "ja" ? `/category/${category.slug}` : `/${lang}/category/${category.slug}`;
                    return (
                        <>
                            <Link color="inherit" href={homeLink}>{homeText}</Link>
                            <Link color="inherit" href={categoryLink}>{category.name}</Link>
                            <Typography sx={{ color: 'text.primary' }}>{title}</Typography>
                        </>
                    );
                })()}
            </Breadcrumbs>
        );
    };
    let posts: any = [];
    const tags = data.postmeta.filter((pm) => pm.taxonomy === "tags");
    const ids: string[] = [];
    for (const term of data.postmeta) {
        const slugTaxonomy = `${term.slug}_${term.taxonomy}`;
        const { data: postmetaData } = await cookiesClient.models.IsPostMeta.listIsPostMetaBySlugTaxonomyAndCreatedAt(
            { slugTaxonomy },
            {
                selectionSet: [
                    "id",
                    "slug",
                    "name",
                    "post.id",
                    "post.slug",
                    "post.title",
                    "post.rewrittenTitle",
                    "post.thumbnail",
                    "post.content",
                    "post.createdAt",
                ]
            }
        );
        for (const v of postmetaData) {
            if (!v.post || ids.includes(v.post.id) || ids.length >= 8) continue;
            const { data: translationsData } = await cookiesClient.models.IsPostsTranslations.listIsPostsTranslationsByPostId({
                postId: v.post.id
            }, {
                filter: { lang: { eq: lang } },
                selectionSet: ["rewrittenTitle"]
            });
            if (!translationsData.length && lang !== "ja") continue;
            ids.push(v.post.id);
            const title = translationsData[0]?.rewrittenTitle ?? v.post?.rewrittenTitle ?? "";
            posts.push({
                id: v.post.id,
                slug: v.post.slug,
                title: v.post.title,
                rewrittenTitle: title,
                thumbnail: v.post?.thumbnail ?? "",
                createdAt: v.post?.createdAt ?? "",
                postmeta: [{
                    id: v?.id ?? "",
                    slug: v.slug,
                    name: v.name
                }]
            });
        }
    };
    return (
        <PageContainer
            title={title}
            description="this is Sample page"
        >
            <BreadcrumbSetter title={title} category={data.postmeta[0]} />
            <DashboardCard title={title}>
                <List dense={false} sx={{ display: "inline-flex", width: "auto" }}>
                    {tags.map((meta) => (
                        <ListItem key={meta.id} sx={{ whiteSpace: "nowrap", paddingRight: 0 }}>
                            <Link href={lang === "ja" ? `/tags/${meta.slug}` : `/${lang}/tags/${meta.slug}`} >
                                <ListItemText primary={`#${meta.name}`} />
                            </Link>
                        </ListItem>
                    ))}
                </List>
                <Image
                    src={`https://${bucketName01}.s3.ap-northeast-1.amazonaws.com/${data.thumbnail as string}`}
                    alt={title}
                    width={400}
                    height={250}
                    style={{
                        width: '40%',
                        height: 'auto',
                        objectFit: 'cover',
                        display: 'block'
                    }}
                />
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
                <Grid container spacing={3} mt={2}>
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
                </Grid>
                <List dense={false} sx={{ display: "inline-flex", width: "auto" }}>
                    {tags.map((meta) => (
                        <ListItem key={meta.id} sx={{ whiteSpace: "nowrap", paddingRight: 0 }}>
                            <Link href={lang === "ja" ? `/tags/${meta.slug}` : `/${lang}/tags/${meta.slug}`} >
                                <ListItemText primary={`#${meta.name}`} />
                            </Link>
                        </ListItem>
                    ))}
                </List>
                <Grid container spacing={3} mt={2} mb={3}>
                    <Blog data={posts} lang={lang} />
                </Grid>
                <BreadcrumbSetter title={title} category={data.postmeta[0]} />
            </DashboardCard>
        </PageContainer>
    );
};

export default SamplePage;

