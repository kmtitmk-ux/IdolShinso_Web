import axios from "axios";
import { TwitterApi } from 'twitter-api-v2';

const xClient = new TwitterApi({
    appKey: process.env.X_API_KEY as string, // コンシューマーキー
    appSecret: process.env.X_API_KEY_SECRET as string, // コンシューマーキーシークレット
    accessToken: process.env.X_ACCESS_TOKEN as string,
    accessSecret: process.env.X_ACCESS_SECRET as string,
});
const X_USER_ID: string = process.env.X_USER_ID ?? "";
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN || "";
const clientV2 = xClient.v2;

// 投稿
export async function postToX(contentText: string) {
    const { data } = await clientV2.tweet(contentText);
    console.info("Tweet Published:", data);
    return data.id;
}

// リプライ投稿
export async function replyToX(
    text: string,
    snsPostId: string,
) {
    const rwClient = xClient.readWrite;
    const publish = await rwClient.v2.reply(text, snsPostId);
    console.info("Reply Published:", publish.data);
    return publish.data.id;
}

interface TweetInsight {
    id: string;
    public_metrics: {
        like_count: number;
        retweet_count: number;
        impression_count: number;
    };
}
interface TweetInsightsResponse {
    data: TweetInsight[];
}

// 投稿のインサイト取得
export async function getPostInsights(ids: string[]): Promise<TweetInsightsResponse> {
    console.info("getPostInsights", ids);
    const url = `https://api.x.com/2/tweets?ids=${ids.join(",")}&tweet.fields=public_metrics`;
    const { data } = await axios.get<TweetInsightsResponse>(url, { headers: { Authorization: `Bearer ${X_BEARER_TOKEN}` } });
    console.info("getPostInsights response", data);
    return data;
}

// いいねしたツイートの取得
// interface Tweet {
//     id: string;
//     text: string;
//     author_id?: string;
//     created_at?: string;
//     public_metrics?: {
//         retweet_count: number;
//         reply_count: number;
//         like_count: number;
//         quote_count: number;
//     };
// }
export async function getLikedPosts() {
    const result = await clientV2.userLikedTweets(X_USER_ID, {
        max_results: 10,
        "tweet.fields": ["created_at", "author_id", "public_metrics", "text"],
        expansions: ["author_id"],
    });
    console.info("getLikedPosts response", result.tweets);
    return result.tweets ?? [];
}

// ユーザー情報の取得
export async function getUser() {
    const me = await clientV2.me();
    const { id, username, name } = me.data;
    console.info(`ID: ${id}`);
    console.info(`username: @${username}`);
    console.info(`name: ${name}`);
    console.info(`X_USER_ID: ${id}`);
}
