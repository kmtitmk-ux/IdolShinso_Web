import { notFound } from 'next/navigation';
import Link from "next/link";
import { Box, Grid, Typography, Breadcrumbs, List, ListItem, ListItemText } from '@mui/material';
import PageContainer from '@/app/(DashboardLayout)/components/container/PageContainer';
import DashboardCard from '@/app/(DashboardLayout)/components/shared/DashboardCard';
import Image from "next/image";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import Blog from '@/app/(DashboardLayout)/components/dashboard/Blog';
import { getArticle, getRelatedPosts, getTranslations } from "@/utils/cachedQueries";

export const revalidate = 60;

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

interface PageProps {
    params: Promise<{
        slug: string;
        lang: string;
    }>;
}
export async function generateMetadata({ params }: PageProps) {
    const awaitedParams = await params;
    const { lang, slug } = awaitedParams;
    const { data } = await getArticle(slug);
    if (!data[0]) notFound();
    const siteTitle = lang === "ja" ? "アイドル深層" : lang === "en" ? "Idol Shinsou" : "偶像深層";
    const locale = lang === "ja" ? "ja_JP" : lang === "en" ? "en_US" : "zh-TW";
    const thumbnail = data[0].thumbnail;
    const translation = data[0].postsTranslations.find(t => t.lang === lang);
    let title = translation?.rewrittenTitle || data[0].rewrittenTitle || data[0].title;
    let description = title;
    return {
        title: `${title} | ${siteTitle}`,
        description: `${description}。${siteTitle}`,
        openGraph: {
            title: title,
            description: description,
            url: `https://geinouwasa.com/posts/${slug}`,
            siteName: siteTitle,
            images: [{
                url: `https://${process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN}/${thumbnail}`,
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
            images: [`https://${process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN}/${thumbnail}`],
            creator: '@IdolShinso',
        },
    };
}
const SamplePage = async ({ params }: PageProps) => {
    const awaitedParams = await params;
    const { lang, slug } = awaitedParams;
    const { data: postData } = await getArticle(slug);
    if (!postData[0]) notFound();
    const postsTranslations = postData[0].postsTranslations.filter((pm) => pm.lang === lang)[0];
    const data = { ...postData[0], comments: postData[0].comments ?? [] };
    const title = postsTranslations?.rewrittenTitle || data.rewrittenTitle || "";
    const content = postsTranslations?.content || data.content || "";
    let thumbnailUrl = "";
    if (data.thumbnail) {
        thumbnailUrl = `https://${process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN}/${data.thumbnail}`;
    }
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
    const tags = data.postmeta.filter((pm) => pm.taxonomy === "tags");
    const postmetaResults = await getRelatedPosts(
        data.postmeta.map(term => `${term.slug}_${term.taxonomy}`)
    );
    const allPostmeta = postmetaResults.flatMap(r => r.data);
    const uniquePosts = allPostmeta.reduce<typeof allPostmeta>((acc, v) => {
        if (!v.post || acc.some(a => a.post?.id === v.post!.id) || acc.length >= 8) return acc;
        return [...acc, v];
    }, []);
    const translationsResults = lang === "ja"
        ? uniquePosts.map(() => ({ data: [] as { rewrittenTitle?: string }[] }))
        : await getTranslations(uniquePosts.map(v => v.post!.id), lang);
    const posts = uniquePosts.reduce<any[]>((acc, v, i) => {
        const translationsData = translationsResults[i].data;
        if (!translationsData.length && lang !== "ja") return acc;
        const title = translationsData[0]?.rewrittenTitle ?? v.post?.rewrittenTitle ?? "";
        const imageUrl = v.post?.thumbnail ? `https://${process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN}/${v.post.thumbnail}` : "";
        return [...acc, {
            id: v.post!.id,
            slug: v.post!.slug,
            title: v.post!.title,
            rewrittenTitle: title,
            thumbnail: v.post?.thumbnail ?? "",
            imageUrl,
            createdAt: v.post?.createdAt ?? "",
            postmeta: [{ id: v?.id ?? "", slug: v.slug, name: v.name }]
        }];
    }, []);
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
                {thumbnailUrl && <Image
                    src={thumbnailUrl}
                    alt={title}
                    width={400}
                    height={250}
                    style={{
                        width: '100%',
                        maxWidth: '400px',
                        height: 'auto',
                        objectFit: 'cover',
                        display: 'block',
                    }}
                />}
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
                <Grid container spacing={3} mt={2}>
                    {
                        data.comments && data.comments.map((comment) => (
                            <Grid key={comment.id} size={12}>
                                <div style={{ fontWeight: "bold" }}>{comment.header ?? ""}</div>
                                <div
                                    id="single"
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

