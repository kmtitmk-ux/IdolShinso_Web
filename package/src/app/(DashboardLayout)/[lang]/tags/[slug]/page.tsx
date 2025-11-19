import Category from "@/app/(DashboardLayout)/[lang]/category/[slug]/page";
import { cookiesClient } from "@/utils/amplifyServerUtils";

interface PageProps {
    params: Promise<{
        slug: string;
        lang: string;
    }>;
}
export async function generateMetadata({ params }: PageProps) {
    const { slug, lang } = await params;
    const slugTaxonomy = `${slug}_tags`;
    const { data } = await cookiesClient.models.IsPostMeta.listIsPostMetaBySlugTaxonomyAndCreatedAt({
        slugTaxonomy,
    }, {
        selectionSet: [
            "post.thumbnail",
            "name"
        ]
    });
    return {
        title: `${data[0]?.name}の魅力を深層まで探る｜アイドル深層`,
        description: `【${data[0]?.name}】の魅力をもっと深く知りたいあなたへ。最新ニュース、ライブレポート、メンバーインタビューまで網羅した記事一覧を「アイドル深層」で公開中。今すぐチェックして、推し活をもっと濃くしよう。`
    };
}
const Tag = async ({ params }: PageProps) => {
    return <Category params={params} taxonomy="tags"/>;
};

export default Tag;
