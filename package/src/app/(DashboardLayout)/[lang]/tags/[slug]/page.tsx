import Category from "@/app/(DashboardLayout)/[lang]/category/[slug]/page";
import { getFirstPage } from "@/utils/categoryQuery";

interface PageProps {
    params: Promise<{
        slug: string;
        lang: string;
    }>;
    searchParams: Promise<{
        token?: string;
    }>;
}
export async function generateMetadata({ params, searchParams }: PageProps) {
    const { slug } = await params;
    const { token } = await searchParams;
    const slugTaxonomy = `${decodeURIComponent(slug)}_tags`;
    const { listData } = await getFirstPage(slugTaxonomy, token ?? null);
    return {
        title: `${listData[0]?.name}の魅力を深層まで探る｜アイドル深層`,
        description: `【${listData[0]?.name}】の魅力をもっと深く知りたいあなたへ。最新ニュース、ライブレポート、メンバーインタビューまで網羅した記事一覧を「アイドル深層」で公開中。今すぐチェックして、推し活をもっと濃くしよう。`
    };
}
const Tag = async ({ params, searchParams }: PageProps) => {
    return <Category params={params} taxonomy={"tags"} searchParams={searchParams}/>;
};

export default Tag;
