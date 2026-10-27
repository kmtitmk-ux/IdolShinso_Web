import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, UpdateCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { BedrockAgentRuntimeClient, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { BedrockAgentClient, StartIngestionJobCommand, GetIngestionJobCommand } from "@aws-sdk/client-bedrock-agent";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import * as dynamodbHelpers from "../shared/dynamodb-helpers.js";
import type { Handler } from "aws-lambda";
import type { Schema } from "../../data/resource";

const TABLE_NAME_SNS_POSTS = process.env.TABLE_NAME_SNS_POSTS ?? "";
const TABLE_NAME_POSTS = process.env.TABLE_NAME_POSTS ?? "";
const TABLE_NAME_POST_META = process.env.TABLE_NAME_POST_META ?? "";
const TABLE_NAME_COMMENTS = process.env.TABLE_NAME_COMMENTS ?? "";
const TABLE_NAME_POST_ANALYTICS = process.env.TABLE_NAME_POST_ANALYTICS ?? "";
const BUCKET_NAME_01 = process.env.BUCKET_NAME_01 ?? "";
const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID ?? "";
const KB_DATA_SOURCE_ID = process.env.KB_DATA_SOURCE_ID ?? "";
const s3Client = new S3Client({});
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrockAgentRuntime = new BedrockAgentRuntimeClient({});
const bedrockAgent = new BedrockAgentClient({});
const bedrockRuntime = new BedrockRuntimeClient({});

type BaseItem = { id: string; createdAt?: string | null; s3Key?: string | null; };

type ExportConfig = {
    tableName: string;
    indexName: string;
    keyCondition: string;
    names: Record<string, string>;
    values: Record<string, unknown>;
    s3Prefix: string;
    filterLang?: string;
};

const since = () => dayjs().subtract(14, "day").toISOString();

const stripHtml = (html: string) =>
    html.replace(/<[^>]*>/g, " ").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

const extractImages = (html: string): string[] => {
    const urls: string[] = [];
    const re = /<img[^>]+src=["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) urls.push(m[1]);
    return urls;
};

async function exportToS3<T extends BaseItem>(cfg: ExportConfig) {
    const items = (await dynamodbHelpers.queryToDynamo(
        cfg.tableName,
        cfg.indexName,
        cfg.keyCondition,
        cfg.filterLang ? "#lang = :lang" : undefined,
        { ...cfg.names, "#createdAt": "createdAt", ...(cfg.filterLang ? { "#lang": "lang" } : {}) },
        { ...cfg.values, ":createdAt": since(), ...(cfg.filterLang ? { ":lang": cfg.filterLang } : {}) },
        0
    )) as T[];

    // s3Keyを確定（既存優先、無ければ日付から生成）。新規生成分は isNew で識別
    const resolved = items.filter((item) => !!item.createdAt).map((item) => {
        const d = dayjs(item.createdAt!);
        const isNew = !item.s3Key;
        const s3Key = item.s3Key ?? `${cfg.s3Prefix}/${d.format("YYYY/MM")}/${d.format("YYYY-MM-DD")}.jsonl`;
        return { item, s3Key, isNew };
    });

    // 新規生成分だけDB更新
    await Promise.all(
        resolved
            .filter((r) => r.isNew)
            .map((r) =>
                docClient.send(new UpdateCommand({
                    TableName: cfg.tableName,
                    Key: { id: r.item.id },
                    UpdateExpression: "SET #s3Key = :s3Key",
                    ExpressionAttributeNames: { "#s3Key": "s3Key" },
                    ExpressionAttributeValues: { ":s3Key": r.s3Key }
                }))
            )
    );

    // s3Keyごとに JSONL 化
    const files: Record<string, string> = {};
    for (const { item, s3Key } of resolved) {
        files[s3Key] = (files[s3Key] ?? "") + JSON.stringify({ ...item, s3Key }) + "\n";
    }

    // 並列アップロード
    await Promise.all(
        Object.entries(files).map(([Key, Body]) =>
            s3Client.send(new PutObjectCommand({ Bucket: BUCKET_NAME_01, Key, Body }))
        )
    );
}

type RelatedMaps = {
    metaMap: Record<string, string[]>;
    commentsMap: Record<string, string[]>;
    analyticsMap: Record<string, Array<Schema["IsPostAnalytics"]["type"]>>;
};

async function fetchRelated(postIds: string[]): Promise<RelatedMaps> {
    if (postIds.length === 0) return { metaMap: {}, commentsMap: {}, analyticsMap: {} };

    // 3テーブルは互いに依存しないので並列取得
    const [allMeta, allComments, allAnalytics] = await Promise.all([
        // IsPostMeta: postId の GSI を Query
        Promise.all(
            postIds.map((pid) =>
                dynamodbHelpers.queryToDynamo(
                    TABLE_NAME_POST_META,
                    "gsi-IsPosts.postmeta",
                    "#postId = :postId",
                    undefined,
                    { "#postId": "postId" },
                    { ":postId": pid },
                    0,
                    false
                )
            )
        ).then((r) => r.flat() as Array<Schema["IsPostMeta"]["type"]>),

        // IsComments: postId + createdAt の GSI を Query
        Promise.all(
            postIds.map((pid) =>
                dynamodbHelpers.queryToDynamo(
                    TABLE_NAME_COMMENTS,
                    "isCommentsByPostIdAndCreatedAt",
                    "#postId = :postId",
                    undefined,
                    { "#postId": "postId" },
                    { ":postId": pid },
                    20,
                    false
                )
            )
        ).then((r) => r.flat() as Array<Schema["IsComments"]["type"]>),

        // IsPostAnalytics: postId の GSI を Query
        Promise.all(
            postIds.map((pid) =>
                dynamodbHelpers.queryToDynamo(
                    TABLE_NAME_POST_ANALYTICS,
                    "gsi-IsPosts.postAnalytics",
                    "#postId = :postId",
                    undefined,
                    { "#postId": "postId" },
                    { ":postId": pid },
                    0,
                    false
                )
            )
        ).then((r) => r.flat() as Array<Schema["IsPostAnalytics"]["type"]>),
    ]);

    // postId ごとにマップ化(Query 済みなので他記事のデータは混ざらない)
    const metaMap: Record<string, string[]> = {};
    for (const m of allMeta) {
        if (!m.postId) continue;
        (metaMap[m.postId] ??= []).push(m.name);
    }

    const commentsMap: Record<string, string[]> = {};
    for (const c of allComments) {
        if (!c.postId || !c.content) continue;
        (commentsMap[c.postId] ??= []).push(c.content);
    }

    const analyticsMap: Record<string, Array<Schema["IsPostAnalytics"]["type"]>> = {};
    for (const a of allAnalytics) {
        if (!a.postId) continue;
        (analyticsMap[a.postId] ??= []).push(a);
    }

    return { metaMap, commentsMap, analyticsMap };
}

export const handler: Handler = async (event) => {
    console.info(`EVENT: ${JSON.stringify(event)}`);

    switch (event.procType) {
        case "startIngestion": {
            const res = await bedrockAgent.send(new StartIngestionJobCommand({
                knowledgeBaseId: KNOWLEDGE_BASE_ID,
                dataSourceId: KB_DATA_SOURCE_ID,
            }));
            return { ingestionJobId: res.ingestionJob?.ingestionJobId, status: res.ingestionJob?.status };
        }

        case "checkIngestion": {
            const res = await bedrockAgent.send(new GetIngestionJobCommand({
                knowledgeBaseId: KNOWLEDGE_BASE_ID,
                dataSourceId: KB_DATA_SOURCE_ID,
                ingestionJobId: event.ingestionJobId,
            }));
            const status = res.ingestionJob?.status ?? "FAILED";
            return { ingestionJobId: event.ingestionJobId, status, done: status === "COMPLETE" };
        }

        case "createDailyPostFile": {
            const posts = (await dynamodbHelpers.queryToDynamo(
                TABLE_NAME_POSTS,
                "isPostsByStatusAndCreatedAt",
                "#status = :status AND #createdAt >= :createdAt",
                undefined,
                { "#status": "status", "#createdAt": "createdAt" },
                { ":status": "published", ":createdAt": since() },
                0
            )) as Array<Schema["IsPosts"]["type"]>;

            const postIds = posts.map((p) => p.id);
            // ここ確認
            const { metaMap, commentsMap, analyticsMap } = await fetchRelated(postIds);

            // s3Key 確定・DB更新
            const resolved = posts.filter((p) => !!p.createdAt).map((post) => {
                const d = dayjs(post.createdAt!);
                const isNew = !post.s3Key;
                const s3Key = post.s3Key ?? `KB/POST_DATA/ENGAGEMENT/${d.format("YYYY/MM")}/${d.format("YYYY-MM-DD")}.jsonl`;
                return { post, s3Key, isNew };
            });

            await Promise.all(
                resolved.filter((r) => r.isNew).map((r) =>
                    docClient.send(new UpdateCommand({
                        TableName: TABLE_NAME_POSTS,
                        Key: { id: r.post.id },
                        UpdateExpression: "SET #s3Key = :s3Key",
                        ExpressionAttributeNames: { "#s3Key": "s3Key" },
                        ExpressionAttributeValues: { ":s3Key": r.s3Key }
                    }))
                )
            );

            const files: Record<string, string> = {};
            for (const { post, s3Key } of resolved) {
                const record = {
                    id: post.id,
                    title: post.title,
                    status: post.status,
                    createdAt: post.createdAt,
                    rewrittenTitle: post.rewrittenTitle,
                    thumbnail: post.thumbnail,
                    s3Key,
                    categories: metaMap[post.id] ?? [],
                    comments: (commentsMap[post.id] ?? []).slice(0, 20),
                    analytics: analyticsMap[post.id] ?? [],
                };
                files[s3Key] = (files[s3Key] ?? "") + JSON.stringify(record) + "\n";
            }

            await Promise.all(
                Object.entries(files).map(([Key, Body]) =>
                    s3Client.send(new PutObjectCommand({ Bucket: BUCKET_NAME_01, Key, Body }))
                )
            );
            break;
        }

        case "createDailySnsFile":
            for (const platform of ["x", "threads"]) {
                try {
                    await exportToS3<Schema["IsSns"]["type"]>({
                        tableName: TABLE_NAME_SNS_POSTS,
                        indexName: "isSnsByPlatformAndCreatedAt",
                        keyCondition: "#platform = :platform AND #createdAt >= :createdAt",
                        names: { "#platform": "platform" },
                        values: { ":platform": platform },
                        s3Prefix: `KB/SNS_POST_DATA/${platform.toUpperCase()}/ENGAGEMENT`,
                        filterLang: "ja",
                    });
                } catch (error) {
                    console.warn(`platform=${platform} failed`, error);
                }
            }
            break;

        case "generateWeeklyArticle": {
            const id = uuidv4();
            const now = dayjs();
            const weekStartLabel = now.subtract(7, "day").format("YYYY-MM-DD");
            const weekEndLabel = now.format("YYYY-MM-DD");

            // S3からプロンプトテンプレートを取得
            const promptObj = await s3Client.send(new GetObjectCommand({
                Bucket: BUCKET_NAME_01,
                Key: "private/prompt/WEEKLY_ARTICLE.txt",
            }));
            const promptTemplate = await promptObj.Body!.transformToString();

            // KBから関連データを検索(取れた分だけ使う)
            const retrieved = await bedrockAgentRuntime.send(new RetrieveCommand({
                knowledgeBaseId: KNOWLEDGE_BASE_ID,
                retrievalQuery: { text: `${weekStartLabel}から${weekEndLabel}のアイドル記事 エンゲージメント コメント カテゴリー` },
                retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: 50 } },
            }));
            const kbContext = (retrieved.retrievalResults ?? [])
                .map((r) => r.content?.text ?? "")
                .filter(Boolean)
                .join("\n\n");

            // 置換は3つだけ(関数形式なので、データ内の "$&" などが壊れない)
            const finalPrompt = promptTemplate
                .replace(/\{\{weekStart\}\}/g, () => weekStartLabel)
                .replace(/\{\{weekEnd\}\}/g, () => weekEndLabel)
                .replace(/\{\{kbContext\}\}/g, () => kbContext);

            // 未置換の変数が残っていればログに出す
            const leftover = finalPrompt.match(/\{\{[^}]+\}\}/g);
            if (leftover) console.warn(`Unreplaced placeholders: ${[...new Set(leftover)].join(", ")}`);


            // Claudeで記事生成
            const invokeRes = await bedrockRuntime.send(new InvokeModelCommand({
                modelId: "global.anthropic.claude-sonnet-5-5",
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify({
                    anthropic_version: "bedrock-2023-05-31",
                    max_tokens: 8192,
                    thinking: { type: "adaptive" },
                    output_config: { effort: "low" },
                    messages: [{ role: "user", content: finalPrompt }],
                }),
            }));
            // 停止理由と使用トークンを必ず確認
            const invokeBody = JSON.parse(new TextDecoder().decode(invokeRes.body));
            console.info(`stop_reason: ${invokeBody.stop_reason}`);
            console.info(`usage: ${JSON.stringify(invokeBody.usage)}`);

            if (invokeBody.stop_reason === "max_tokens") {
                throw new Error(
                    `出力が max_tokens で切れました: ${JSON.stringify(invokeBody.usage)}`
                );
            }

            const articleContent: string = (invokeBody.content ?? [])
                .filter((b: { type: string; }) => b.type === "text")
                .map((b: { text: string; }) => b.text)
                .join("");

            const article = JSON.parse(articleContent)

            const MAX = 200;
            const m = article.content.match(/^([\s\S]*?)<h2[\s>]/i);
            if (m) {
                // h2 がある: 手前までをHTMLのまま
                article.excerpt = m[1].trim();
            } else {
                // h2 がない: タグを除去して200文字まで
                const text = article.content.replace(/<[^>]*>/g, "").trim();
                article.excerpt = text.length > MAX ? text.slice(0, MAX) + "…" : text;
            }
            console.info({ article });

            // 各フィールドを個別に取得
            const title: string = article.title;
            const content: string = article.content;
            const excerpt: string = article.excerpt;
            const nowIso = now.toISOString();
            const putParams = {
                TableName: TABLE_NAME_POSTS,
                Item: {
                    id,
                    title,
                    slug: id,
                    content,
                    excerpt,
                    rewrittenTitle: title,
                    // thumbnail: null,
                    // s3Key: null,
                    status: "published",
                    visibility: "members",
                    createdAt: nowIso,
                    updatedAt: nowIso
                }
            };
            console.info(`Putting weekly article to DynamoDB: ${JSON.stringify(putParams)}`);
            await docClient.send(new PutCommand(putParams));
            break;
        }

        default:
            throw new Error(`Unknown procType: ${event.procType}`);
    }

    return { statusCode: 200, body: "" };
};
