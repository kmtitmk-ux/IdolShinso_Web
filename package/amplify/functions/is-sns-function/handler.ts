import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    GetCommand,
    PutCommand,
    PutCommandInput,
    QueryCommand,
    QueryCommandInput,
    DynamoDBDocumentClient
} from "@aws-sdk/lib-dynamodb";
import { TwitterApi } from 'twitter-api-v2';
import dayjs from "dayjs";
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';
import { getUserId, postToThreads, getPostInsights, replyToThread } from './threads';
import type { Handler } from 'aws-lambda';

const TABLE_ID = process.env.TABLE_ID as string;
const TABLE_NAME_IS_SNS = `IsSns-${TABLE_ID}`;
const TABLE_NAME_IS_POSTS = `IsPosts-${TABLE_ID}`;
const TABLE_NAME_IS_POSTS_TRANSLATIONS = `IsPostsTranslations-${TABLE_ID}`;
const BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAAID94wEAAAAA5IXCKb40XXHqf0m01kAFcQavlrk%3DCyDmmrA25EgzWoXjywasQue3clUwdOhJfw1xoCY07cVdPKBAfh";
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const xClient = new TwitterApi({
    appKey: 'C8GpCWkENvKBrJbanePsG3tqk',
    appSecret: 'Q4CZWcQpYmpVFOWY2LGWCXbWPyeXWcjccn1Cw0mxiuFqesVesu',
    accessToken: '1981604542614794241-QLzZHGtNmwRMP01wze6aDWyDzay3c1',
    accessSecret: 'rPeTAfHGaFdA7SFVyjjMM40UYhy0jA9NSpuGOvZOz7m82',
});

export const handler: Handler = async (event) => {
    console.info(`EVENT: ${JSON.stringify(event)}`);
    try {
        switch (event.procType) {
            case "postSns": {
                await postSns();
                break;
            }
            case "checkSns": {
                // 投稿後2日〜4日の投稿のエンゲージメントをチェック
                const checkItems = await queryToDynamo(
                    TABLE_NAME_IS_SNS,
                    "isSnsByStatusAndUpdatedAt",
                    "#status = :status AND #updatedAt BETWEEN :start AND :end",
                    { "#status": "status", "#updatedAt": "updatedAt" },
                    {
                        ":status": "posted",
                        ":start": dayjs().subtract(4, "day").toISOString(),
                        ":end": dayjs().subtract(0, "day").toISOString()
                    },
                    20
                );
                if (checkItems.length === 0) {
                    console.info("No items.");
                    break;
                }
                for (const platform of ["x", "threads"]) {
                    for (const lang of ["ja", "en"] as const) {
                        const filteredItems = checkItems.filter(item => item.platform === platform && item.lang === lang);
                        if (filteredItems.length === 0) continue;
                        console.info(`Found ${filteredItems.length} items for ${platform} in ${lang}.`);
                        switch (platform) {
                            case "x": {
                                const ids: string[] = [];
                                for (const v of filteredItems) {
                                    if (v.snsPostId) ids.push(v.snsPostId);
                                }
                                const url = `https://api.x.com/2/tweets?ids=${ids.join(",")}&tweet.fields=public_metrics`;
                                const { data: xDatas } = await axios.get(url, { headers: { Authorization: `Bearer ${BEARER_TOKEN}` } });
                                for (const data of xDatas.data) {
                                    const engagementCount = data.public_metrics.like_count
                                        + data.public_metrics.retweet_count
                                        + data.public_metrics.reply_count
                                        + data.public_metrics.quote_count;
                                    if (engagementCount >= 1) {
                                        // エンゲージメントが一定数を超えたらリプライを投稿
                                        const snsPostId = data.id;
                                        const item = filteredItems.find(item => item.snsPostId === snsPostId);
                                        const postId = item?.postId ?? "";
                                        if (!postId) continue;
                                        const { Item: getResult } = await docClient.send(new GetCommand({
                                            TableName: TABLE_NAME_IS_POSTS,
                                            Key: { id: postId }
                                        }));
                                        console.info("GetCommand result", getResult);
                                        // リプライ実行
                                        const rwClient = xClient.readWrite;
                                        await rwClient.v2.reply(`${getResult?.rewrittenTitle}\n\nhttps://geinouwasa.com/posts/${getResult?.slug}`, snsPostId);
                                        const updateParam = { ...item };
                                        updateParam.status = "replied";
                                        updateParam.updatedAt = dayjs().toISOString();
                                        await putToDynamo(updateParam);
                                    }
                                }
                                break;
                            }
                            case "threads": {
                                for (const item of filteredItems) {
                                    const insights = await getPostInsights(item.snsPostId, lang);
                                    const metrics = insights.data ?? [];
                                    const engagementCount = metrics.reduce((sum: number, metric: any) => {
                                        const value = metric?.values?.[0]?.value ?? 0;
                                        return sum + value;
                                    }, 0);
                                    // エンゲージメントが一定数を超えたらリプライを投稿
                                    if (engagementCount >= 1) {
                                        const postId = item.postId;
                                        const { Item: getResult } = await docClient.send(new GetCommand({
                                            TableName: TABLE_NAME_IS_POSTS,
                                            Key: { id: postId }
                                        }));
                                        console.info("GetCommand result", getResult);
                                        const translationItems = await queryToDynamo(
                                            TABLE_NAME_IS_POSTS_TRANSLATIONS,
                                            "isPostsTranslationsByPostId",
                                            "#postId = :postId",
                                            { "#postId": "postId" },
                                            { ":postId": postId },
                                            1
                                        );
                                        // postText をわかりやすく決定
                                        let postText: string;
                                        if (lang === "ja") {
                                            postText = getResult?.rewrittenTitle;
                                        } else {
                                            postText = translationItems[0]?.rewrittenTitle ?? getResult?.rewrittenTitle;
                                        }
                                        // URL の prefix を整理
                                        const langPrefix = lang === "ja" ? "" : `${lang}/`;
                                        const userId = await getUserId(lang);
                                        await replyToThread(
                                            userId,
                                            item.snsPostId,
                                            `${postText}\n\nhttps://geinouwasa.com/${langPrefix}posts/${getResult?.slug}`,
                                            lang
                                        );
                                        const updateItem = { ...item };
                                        updateItem.status = "replied";
                                        updateItem.updatedAt = dayjs().toISOString();
                                        await putToDynamo(updateItem);
                                    }
                                }
                                break;
                            }
                            default:
                                throw new Error(`Unknown platform: ${platform}`);
                        }
                    }
                }
                break;
            }
            default:
                throw new Error(`Unknown event type: ${event.procType}`);
        }
    } catch (error) {
        console.error(error);
    }
    return {
        statusCode: 200,
        body: ""
    };
};


// SNS投稿のステータスを更新
async function putToDynamo(updateItem: any) {
    const param: PutCommandInput = {
        TableName: TABLE_NAME_IS_SNS,
        Item: updateItem
    };
    console.info("PutCommand param", param);
    const putResult = await docClient.send(new PutCommand(param));
    console.info("PutCommand result", putResult);
}

// 下書きのSNSを投稿
async function postSns() {
    const postItems = await queryToDynamo(
        TABLE_NAME_IS_SNS,
        "isSnsByStatusAndUpdatedAt",
        "#status = :status AND #updatedAt >= :updatedAt",
        { "#status": "status", "#updatedAt": "updatedAt" },
        { ":status": "scheduled", ":updatedAt": dayjs().subtract(2, "day").toISOString() },
        20
    );
    console.info(`Found ${postItems} items to post.`);
    for (const platform of ["x", "threads"]) {
        for (const lang of ["ja", "en"] as const) {
            const postItem = postItems.filter(item => item.lang === lang)[0];
            console.info(`Posting to ${platform} in ${lang} for item:`, postItem);
            if (postItem) {
                const updateItem = { ...postItem };
                switch (platform) {
                    case "x": {
                        updateItem.platform = "x";
                        if (lang === "ja") {
                            updateItem.status = "posted";
                            const clientV2 = xClient.v2;
                            const { data } = await clientV2.tweet(postItem.contentText);
                            updateItem.snsPostId = data.id;
                        } else {
                            updateItem.status = "replied";
                        }
                        break;
                    }
                    case "threads": {
                        updateItem.id = uuidv4();
                        updateItem.platform = "threads";
                        const userId = await getUserId(lang);
                        updateItem.snsPostId = await postToThreads(userId, postItem.contentText, lang);
                        updateItem.status = "posted";
                        break;
                    }
                    default:
                        throw new Error(`Unknown platform: ${platform}`);
                }
                updateItem.updatedAt = dayjs().toISOString();
                await putToDynamo(updateItem);
            }
        }
    }
}

// 
async function queryToDynamo(
    TableName: string,
    IndexName: string | undefined,
    KeyConditionExpression: string,
    ExpressionAttributeNames: Record<string, any>,
    ExpressionAttributeValues: Record<string, any>,
    Limit: number
) {
    const outParam = [];
    const param: QueryCommandInput = {
        TableName,
        IndexName,
        KeyConditionExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        Limit
    };
    do {
        const result = await docClient.send(new QueryCommand(param));
        outParam.push(...result.Items ?? []);
        param.ExclusiveStartKey = result.LastEvaluatedKey;
        if (outParam?.length >= Limit) break;
    } while (param.ExclusiveStartKey);
    return outParam;
}