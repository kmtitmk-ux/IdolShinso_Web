import { Grid, Box } from "@mui/material";
import { cookiesClient, runWithAmplifyServerContext } from "@/utils/amplifyServerUtils";
import { getUrl } from 'aws-amplify/storage/server';
import { cookies } from 'next/headers';
import PageContainer from '@/app/(DashboardLayout)/components/container/PageContainer';
import NextPage from '@/app/(DashboardLayout)/components/container/NextPage';
import Blog from '@/app/(DashboardLayout)/components/dashboard/Blog';

interface PageProps {
    params: Promise<{
        slug: string;
        lang: string;
    }>;
}
export async function generateMetadata({ params }: PageProps) {
    const { slug } = await params;
    const slugTaxonomy = `${decodeURIComponent(slug)}_category`;
    const { data } = await cookiesClient.models.IsPostMeta.listIsPostMetaBySlugTaxonomyAndCreatedAt({
        slugTaxonomy,
    }, {
        selectionSet: ["post.thumbnail", "name"]
    });
    return {
        title: `${data[0]?.name}の魅力を深層まで探る｜アイドル深層`,
        description: `【${data[0]?.name}】の魅力をもっと深く知りたいあなたへ。最新ニュース、ライブレポート、メンバーインタビューまで網羅した記事一覧を「アイドル深層」で公開中。今すぐチェックして、推し活をもっと濃くしよう。`
    };
}
const Category = async ({ params, taxonomy }: any) => {
    const { slug, lang } = await params;
    const slugTaxonomy = `${decodeURIComponent(slug)}_${taxonomy ?? "category"}`;
    let nextToken: string | null = null;
    let listData: any = [];
    const selectionSet = [
        "post.id",
        "post.slug",
        "post.title",
        "post.rewrittenTitle",
        "post.thumbnail",
        "post.createdAt",
        "id",
        "slug",
        "name",
        "createdAt"
    ] as const;
    const listParams = {
        limit: 8,
        selectionSet,
        nextToken: null as string | null,
        sortDirection: "DESC" as const,
    };
    do {
        const { data, nextToken: newNextToken } = await cookiesClient.models.IsPostMeta
            .listIsPostMetaBySlugTaxonomyAndCreatedAt({ slugTaxonomy }, listParams);
        const filterData = data.filter(v => v.post != null);
        listData = [...listData, ...filterData];
        if (newNextToken) listParams.nextToken = nextToken = newNextToken;
        if (!newNextToken || listData.length >= listParams.limit) break;
    } while (true);

    const editData: any = [];
    for (const v of listData) {
        if (!v.post) continue;
        const { data: translationsData } = await cookiesClient.models.IsPostsTranslations.listIsPostsTranslationsByPostId({
            postId: v.post.id
        }, {
            filter: { lang: { eq: lang } },
            selectionSet: ["rewrittenTitle"]
        });
        let imageUrl = "";
        if (v.post.thumbnail) {
            const { url } = await runWithAmplifyServerContext({
                nextServerContext: { cookies },
                operation: (contextSpec) => getUrl(contextSpec, {
                    path: v.post.thumbnail,
                    options: { expiresIn: 3600 }
                })
            });
            imageUrl = url.toString();
            console.log("imageUrl", imageUrl);
        }
        editData.push({
            id: v.post.id,
            slug: v.post.slug,
            title: v.post.title,
            rewrittenTitle: translationsData[0]?.rewrittenTitle ?? v.post?.rewrittenTitle ?? "",
            thumbnail: v.post?.thumbnail ?? "",
            imageUrl,
            createdAt: v.post?.createdAt ?? "",
            postmeta: [{ id: v?.id ?? "", slug: v.slug, name: v.name }]
        });
    }
    return (
        <>
            <PageContainer title={listData[0]?.name ?? ""} description="">
                <Box>
                    <Grid container spacing={3}>
                        {editData.length ? <Blog data={editData} lang={lang} /> : ""}
                        <NextPage
                            token={nextToken ?? ""}
                            queryType={"category"}
                            pk={slugTaxonomy}
                            lang={lang}
                        />
                    </Grid>
                </Box>
            </PageContainer>
        </>
    );
};

export default Category;
