const axios = require("axios");
const ACCESS_TOKENS = {
    ja: "THAARHMbSOBk9BYlplT0tfa3RxWkQ0b1JFdFh2U3VtTXFvb2dpdm96dmhyWUFORGdmU1VERjZAiUTNCM2k4QzgwZAFdyNlRPU3FlREtKU05MMVJMemVaUFVHVE8wTDF0SUdhbW5RS2dZAMnA5cDNSZAmNhUjVQVzdVMDZAkSTlQbjZAITXFLZAlRkY1J0aS05anNTa1UZD",
    en: "THAARHMbSOBk9BYlpabUxJQkRlZAVZAFSnRLTDlodDVEVmd3MVRiWUNkeFEtSUtrV0ZATWTNJY0hzNmVYOEdObDFOcGUyLTRLN053d29abFZAGenJ2VFBPb3pCWkZAGMUtJcjFCMktSUGZA3MUJpNlNyLWtiWDFCek90alBMWUt2ZAXp1cTlHU1A2bEgyMlpmR0pialEZD"

};
const GRAPH_BASE = 'https://graph.threads.net/v1.0';

// ユーザーIDを取得
export async function getUserId(lang: "ja" | "en") {
    const res = await axios.get(`${GRAPH_BASE}/me`, {
        params: { access_token: ACCESS_TOKENS[lang] }
    });
    console.info('User ID:', res.data);
    return res.data.id;
}

// 投稿
export async function postToThreads(userId: string, text: string, lang: "ja" | "en") {
    // 下書き作成
    const draft = await axios.post(
        `${GRAPH_BASE}/${userId}/threads`,
        { text },
        {
            params: {
                access_token: ACCESS_TOKENS[lang],
                media_type: 'TEXT'
            }
        }
    );
    console.info('Draft:', draft.data);
    const containerId = draft.data.id;
    // 公開
    await new Promise(r => setTimeout(r, 200));
    const publish = await axios.post(
        `${GRAPH_BASE}/${userId}/threads_publish`,
        { creation_id: containerId },
        { params: { access_token: ACCESS_TOKENS[lang] } }
    );
    console.info('Published:', publish.data);
    return publish.data.id;
}

// リプライ投稿
export async function replyToThread(
    userId: string,
    parentPostId: string,
    text: string,
    lang: "ja" | "en"
) {
    // ① 下書き作成（reply_to_id を追加）
    const draft = await axios.post(
        `${GRAPH_BASE}/${userId}/threads`,
        {
            text,
            reply_to_id: parentPostId,
        },
        {
            params: {
                access_token: ACCESS_TOKENS[lang],
                media_type: "TEXT"
            }
        }
    );
    console.info("Reply Draft:", draft.data);
    const containerId = draft.data.id;
    // ② 公開
    await new Promise(r => setTimeout(r, 200));
    const publish = await axios.post(
        `${GRAPH_BASE}/${userId}/threads_publish`,
        { creation_id: containerId },
        { params: { access_token: ACCESS_TOKENS[lang] } }
    );
    console.info("Reply Published:", publish.data);
    return publish.data.id;
}

// 投稿のインサイト取得
export async function getPostInsights(postId: string, lang: "ja" | "en") {
    console.info(`Getting insights for post ID: ${postId}`);
    const res = await axios.get(
        `${GRAPH_BASE}/${postId}/insights`,
        {
            params: {
                access_token: ACCESS_TOKENS[lang],
                metric: "views,likes,replies,reposts,quotes"
            }
        }
    );
    console.info("Post Insights:", res.data.data);
    return res.data;
}