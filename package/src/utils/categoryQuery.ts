import * as React from 'react';
import { cookiesClient } from '@/utils/amplifyServerUtils';

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

export const getFirstPage = React.cache(async (slugTaxonomy: string, token: string | null) => {
    const listParams = {
        limit: 8,
        selectionSet,
        nextToken: token ?? null as string | null,
        sortDirection: "DESC" as const,
    };
    let listData: any = [];
    let nextToken: string | null = null;
    do {
        const { data, nextToken: newNextToken } = await cookiesClient.models.IsPostMeta
            .listIsPostMetaBySlugTaxonomyAndCreatedAt({ slugTaxonomy }, listParams);
        const filterData = data.filter((v: any) => v.post != null);
        listData = [...listData, ...filterData];
        listParams.nextToken = nextToken = newNextToken ?? "";
        if (!newNextToken || listData.length >= listParams.limit) break;
    } while (true);
    return { listData, nextToken };
});
