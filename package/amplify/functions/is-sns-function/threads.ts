import axios from "axios";
const GRAPH_BASE = 'https://graph.threads.net/v1.0';
const THREADS_ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN;

// ユーザーIDを取得
export async function getUserId() {
    const res = await axios.get(`${GRAPH_BASE}/me`, {
        params: { access_token: THREADS_ACCESS_TOKEN }
    });
    console.info('User ID:', res.data);
    return res.data.id;
}

// 投稿
export async function postToThreads(userId: string, text: string) {
    // 下書き作成
    const draft = await axios.post(
        `${GRAPH_BASE}/${userId}/threads`,
        { text },
        {
            params: {
                access_token: THREADS_ACCESS_TOKEN,
                media_type: 'TEXT'
            }
        }
    );
    console.info('Draft:', draft.data);
    const containerId = draft.data.id;
    // 公開
    await new Promise(r => setTimeout(r, 2000));
    const publish = await axios.post(
        `${GRAPH_BASE}/${userId}/threads_publish`,
        { creation_id: containerId },
        { params: { access_token: THREADS_ACCESS_TOKEN } }
    );
    console.info('Published:', publish.data);
    return publish.data.id;
}

// リプライ投稿
export async function replyToThreads(
    userId: string,
    parentPostId: string,
    text: string,
) {
    console.info("Replying to post:", { userId, parentPostId, text });
    // ① 下書き作成（reply_to_id を追加）
    const draft = await axios.post(
        `${GRAPH_BASE}/${userId}/threads`,
        {
            text,
            reply_to_id: parentPostId,
        },
        {
            params: {
                access_token: THREADS_ACCESS_TOKEN,
                media_type: "TEXT"
            }
        }
    );
    console.info("Reply Draft:", draft.data);
    const containerId = draft.data.id;
    // ② 公開
    await new Promise(r => setTimeout(r, 2000));
    const publish = await axios.post(
        `${GRAPH_BASE}/${userId}/threads_publish`,
        { creation_id: containerId },
        { params: { access_token: THREADS_ACCESS_TOKEN } }
    );
    console.info("Reply Published:", publish.data);
    return publish.data.id;
}

// 投稿のインサイト取得
export async function getPostInsights(postId: string) {
    console.info(`Getting insights for post ID: ${postId}`);
    const res = await axios.get(
        `${GRAPH_BASE}/${postId}/insights`,
        {
            params: {
                access_token: THREADS_ACCESS_TOKEN,
                metric: "views,likes,replies,reposts,quotes"
            }
        }
    );
    console.info("Post Insights:", JSON.stringify(res.data, null, 2));
    return res.data;
}
