import axios from "axios";
import { TwitterApi } from 'twitter-api-v2';

const xClient = new TwitterApi({
    appKey: process.env.X_API_KEY as string, // コンシューマーキー
    appSecret: process.env.X_API_KEY_SECRET as string, // コンシューマーキーシークレット
    accessToken: process.env.X_ACCESS_TOKEN as string,
    accessSecret: process.env.X_ACCESS_SECRET as string,
});

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


// 投稿のインサイト取得
export async function getPostInsights(ids: string[]) {
    console.info("getPostInsights", ids);
    const url = `https://api.x.com/2/tweets?ids=${ids.join(",")}&tweet.fields=public_metrics`;
    const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${X_BEARER_TOKEN}` } });
    console.info("getPostInsights response", data);
    return data;
}