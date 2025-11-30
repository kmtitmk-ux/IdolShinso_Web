import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    GetCommand,
    QueryCommand,
    QueryCommandInput,
    UpdateCommand,
    UpdateCommandInput,
    DynamoDBDocumentClient
} from "@aws-sdk/lib-dynamodb";
import { TwitterApi } from 'twitter-api-v2';
import dayjs from "dayjs";
import axios from "axios";
import type { Handler } from 'aws-lambda';

const TABLE_ID = process.env.TABLE_ID as string;
const TABLE_NAME_IS_SNS = `IsSns-${TABLE_ID}`;
const TABLE_NAME_IS_POSTS = `IsPosts-${TABLE_ID}`;
const BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAAID94wEAAAAA5IXCKb40XXHqf0m01kAFcQavlrk%3DCyDmmrA25EgzWoXjywasQue3clUwdOhJfw1xoCY07cVdPKBAfh";
const BEARER_TOKEN_EN = "AAAAAAAAAAAAAAAAAAAAAFF75gEAAAAA68JRXhHzEBgQVygK5%2FIE3Z6GXYw%3DCZJtiRYnfsx4st7KzPVhhkpqiF68oJpyQk1SgFyRCuhJhe7PXJ";
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const client = {
    ja: new TwitterApi({
        appKey: 'C8GpCWkENvKBrJbanePsG3tqk',
        appSecret: 'Q4CZWcQpYmpVFOWY2LGWCXbWPyeXWcjccn1Cw0mxiuFqesVesu',
        accessToken: '1981604542614794241-QLzZHGtNmwRMP01wze6aDWyDzay3c1',
        accessSecret: 'rPeTAfHGaFdA7SFVyjjMM40UYhy0jA9NSpuGOvZOz7m82',
    }),
    en: new TwitterApi({
        appKey: 'WfObgNR7WoE6j3izNQZlaLaE8',
        appSecret: 'rYeiAHqzvOeYyWn6nUoTU2DwXBPsUNK4GLNH38FA1o15q51Z39',
        accessToken: '2823981007-4kdmGbu0wzkQNwz3RyEzT6BkDEvewC3Fof0Dp7m',
        accessSecret: '7jdL24n7Xrjnze1m4khApnXLipFQhbCMyUgEidjpu2ASk',
    })
};

export const handler: Handler = async (event) => {
    console.info(`EVENT: ${JSON.stringify(event)}`);
    try {
        switch (event.procType) {
            case "postSns": {
                const postedItems = await postSns();
                for (const item of postedItems) {
                    await updateToDynamo(item);
                }
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
                        ":start": dayjs().subtract(5, "day").toISOString(),
                        ":end": dayjs().subtract(3, "day").toISOString()
                    },
                    20
                );
                if (checkItems.length === 0) {
                    console.info("No items.");
                    break;
                }
                const ids: string[] = [];
                for (const v of checkItems) {
                    ids.push(v.snsPostId);
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
                        const { Item: getResult } = await docClient.send(new GetCommand({
                            TableName: TABLE_NAME_IS_POSTS,
                            Key: { id: snsPostId }
                        }));
                        console.info("GetCommand result", getResult);
                        const checkItem = checkItems.filter(item => item.snsPostId === snsPostId)[0];
                        const lang: "ja" | "en" = checkItem.lang;
                        const rwClient = client[lang].readWrite;
                        await rwClient.v2.reply(`${getResult?.rewrittenTitle}\n\nhttps://geinouwasa.com/posts/${getResult?.slug}`, snsPostId);
                        const updateParam = checkItems.filter(item => item.snsPostId === snsPostId)[0];
                        updateParam.status = "replied";
                        updateParam.updatedAt = dayjs().toISOString();
                        await updateToDynamo(updateParam);
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
async function updateToDynamo(updateItem: any) {
    const updateParam: UpdateCommandInput = {
        TableName: TABLE_NAME_IS_SNS,
        Key: { id: updateItem.id },
        UpdateExpression: "SET #status = :status, #updatedAt = :updatedAt, #snsPostId = :snsPostId, #platform = :platform",
        ExpressionAttributeNames: {
            "#status": "status",
            "#updatedAt": "updatedAt",
            "#snsPostId": "snsPostId",
            "#platform": "platform"
        },
        ExpressionAttributeValues: {
            ":status": updateItem.status,
            ":updatedAt": updateItem.updatedAt,
            ":snsPostId": updateItem.snsPostId,
            ":platform": updateItem.platform
        }
    };
    console.info("UpdateCommand param", updateParam);
    const updateResult = await docClient.send(new UpdateCommand(updateParam));
    console.info("UpdateCommand result", updateResult);
}

// 下書きのSNSを投稿
async function postSns() {
    const outParam = [];
    const psotItems = await queryToDynamo(
        TABLE_NAME_IS_SNS,
        "isSnsByStatusAndUpdatedAt",
        "#status = :status AND #updatedAt >= :updatedAt",
        { "#status": "status", "#updatedAt": "updatedAt" },
        { ":status": "scheduled", ":updatedAt": dayjs().subtract(2, "day").toISOString() },
        20
    );
    for (const lang of ["ja", "en"] as const) {
        const postItem = psotItems.filter(item => item.lang === lang)[0];
        if (!postItem) continue;
        console.info(`Posting SNS item: ${postItem}`);
        const clientV2 = client[lang].v2;
        const { data } = await clientV2.tweet(postItem.contentText);
        postItem.snsPostId = data.id;
        postItem.status = "posted";
        postItem.platform = "x";
        postItem.updatedAt = dayjs().toISOString();
        outParam.push(postItem);
    }
    return outParam;
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
        console.info("QueryCommand param", param);
        const result = await docClient.send(new QueryCommand(param));
        console.info("QueryCommand result", result);
        outParam.push(...result.Items ?? []);
        param.ExclusiveStartKey = result.LastEvaluatedKey;
        if (outParam?.length >= Limit) break;
    } while (param.ExclusiveStartKey);
    return outParam;
}