import { unstable_cache } from 'next/cache';
import { publicClient } from '@/utils/amplifyPublicClient';

const REVALIDATE = 60;

const postSelectionSet = [
    "id", "slug", "title", "rewrittenTitle", "thumbnail", "createdAt",
    "postmeta.id", "postmeta.slug", "postmeta.name", "postmeta.taxonomy",
    "postsTranslations.lang", "postsTranslations.rewrittenTitle",
] as const;

export const getPostsByStatus = unstable_cache(
    async (token: string | null) => {
        return publicClient.models.IsPosts.listIsPostsByStatusAndCreatedAt(
            { status: "published" },
            { nextToken: token, sortDirection: "DESC", limit: 8, selectionSet: postSelectionSet }
        );
    },
    ['getPostsByStatus'],
    { revalidate: REVALIDATE }
);

export const getPostsByDateRange = unstable_cache(
    async (start: string, end: string, token: string | null) => {
        const selectionSet = ["id", "slug", "title", "rewrittenTitle", "thumbnail", "createdAt"] as const;
        const listParams = {
            limit: 8, selectionSet,
            nextToken: token ?? null as string | null,
            sortDirection: "DESC" as const,
        };
        const pk = { status: "published", createdAt: { between: [start, end] as [string, string] } };
        let listData: any[] = [];

        let nextToken: string | null = null;
        do {
            const { data, nextToken: newNextToken } = await publicClient.models.IsPosts.listIsPostsByStatusAndCreatedAt(pk, listParams);
            listData = [...listData, ...data];
            listParams.nextToken = nextToken = newNextToken ?? "";
            if (!newNextToken || listData.length >= listParams.limit) break;
        } while (true);
        return { listData, nextToken, pk };
    },
    ['getPostsByDateRange'],
    { revalidate: REVALIDATE }
);

export const getTranslations = unstable_cache(
    async (postIds: string[], lang: string) => {
        return Promise.all(
            postIds.map(postId =>
                publicClient.models.IsPostsTranslations.listIsPostsTranslationsByPostId(
                    { postId },
                    { filter: { lang: { eq: lang } }, selectionSet: ["rewrittenTitle"] }
                )
            )
        );
    },
    ['getTranslations'],
    { revalidate: REVALIDATE }
);

export const getArticle = unstable_cache(
    async (slug: string) => {
        return publicClient.models.IsPosts.listIsPostsBySlug(
            { slug: decodeURIComponent(slug) },

            {
                selectionSet: [
                    "id", "slug", "title", "rewrittenTitle", "thumbnail", "content", "createdAt",
                    "postmeta.id", "postmeta.name", "postmeta.slug", "postmeta.taxonomy",
                    "postsTranslations.lang", "postsTranslations.rewrittenTitle", "postsTranslations.content",
                    "comments.id", "comments.createdAt", "comments.header", "comments.content",
                ]
            }
        );
    },
    ['getArticle'],
    { revalidate: REVALIDATE }
);

export const getRelatedPosts = unstable_cache(
    async (slugTaxonomyList: string[]) => {
        return Promise.all(
            slugTaxonomyList.map(slugTaxonomy =>
                publicClient.models.IsPostMeta.listIsPostMetaBySlugTaxonomyAndCreatedAt(
                    { slugTaxonomy },
                    {
                        selectionSet: [
                            "id", "slug", "name",
                            "post.id", "post.slug", "post.title", "post.rewrittenTitle",
                            "post.thumbnail", "post.content", "post.createdAt",
                        ]
                    }
                )
            )
        );
    },
    ['getRelatedPosts'],

    { revalidate: REVALIDATE }
);

export const getCategoryList = unstable_cache(
    async () => {
        const { data, errors } = await publicClient.models.IsTerms.listIsTermsByTaxonomy(
            { taxonomy: "category" },
            { limit: 10, selectionSet: ["id", "slug", "name"] as const }
        );
        if (errors) console.error("Error fetching category data:", errors);
        return data;
    },
    ['getCategoryList'],
    { revalidate: REVALIDATE }
);

export const getArchiveRange = unstable_cache(
    async () => {
        const selectionSet = ["createdAt"] as const;
        const listParams = { limit: 1, selectionSet };
        const [{ data: latestData, errors: latestErrors }, { data: oldestData, errors: oldestErrors }] = await Promise.all([
            publicClient.models.IsPosts.listIsPostsByStatusAndCreatedAt({ status: "published" }, { ...listParams, sortDirection: "DESC" }),
            publicClient.models.IsPosts.listIsPostsByStatusAndCreatedAt({ status: "published" }, listParams),
        ]);
        if (latestErrors || oldestErrors) console.error("Error fetching archive data:", latestErrors || oldestErrors);
        return [latestData, oldestData];
    },
    ['getArchiveRange'],
    { revalidate: REVALIDATE }
);