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
import { title } from "process";
import { ReadWriteType } from "aws-cdk-lib/aws-cloudtrail";

const TABLE_ID = process.env.TABLE_ID as string;
const TABLE_NAME_IS_SNS = `IsSns-${TABLE_ID}`;
const TABLE_NAME_IS_POSTS = `IsPosts-${TABLE_ID}`;
const BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAAID94wEAAAAA5IXCKb40XXHqf0m01kAFcQavlrk%3DCyDmmrA25EgzWoXjywasQue3clUwdOhJfw1xoCY07cVdPKBAfh";
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const client = new TwitterApi({
    appKey: 'zQyOKkGBgnPYnKnMwPcqihN2b',
    appSecret: 'e44Bs3vwIVBckrSblW347TaS6LkvUC54g8Sy0gG47wHT0JZrQy',
    accessToken: '1981604542614794241-IdRjMqvtsaVPtfVlbnBtJej1UvFqB6',
    accessSecret: 'AvcpfpauimZTP9RzWthJizUSGShB0XKD1DalXrTtoDpCx',
});

export const handler: Handler = async (event) => {
    console.info(`EVENT: ${JSON.stringify(event)}`);
    try {
        switch (event.procType) {
            case "postSns": {
                const postedItem = await postSns();
                await updateToDynamo(postedItem);
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
                    1
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
                const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${BEARER_TOKEN}` } });
                const engagementCount = data.data[0].public_metrics.like_count
                    + data.data[0].public_metrics.retweet_count
                    + data.data[0].public_metrics.reply_count
                    + data.data[0].public_metrics.quote_count;
                if (engagementCount >= 2) {
                    // エンゲージメントが一定数を超えたらリプライを投稿
                    const { Item: getResult } = await docClient.send(new GetCommand({
                        TableName: TABLE_NAME_IS_POSTS,
                        Key: { id: checkItems[0].postId }
                    }));
                    console.info("GetCommand result", getResult);
                    const rwClient = client.readWrite;
                    await rwClient.v2.reply(`${getResult?.rewrittenTitle}\n\nhttps://geinouwasa.com/posts/${getResult?.slug}`, data.data[0].id);
                    const updateParam = checkItems.filter(item => item.snsPostId === data.data[0].id)[0];
                    updateParam.status = "replied";
                    updateParam.updatedAt = dayjs().toISOString();
                    await updateToDynamo(updateParam);
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
    const psotItems = await queryToDynamo(
        TABLE_NAME_IS_SNS,
        "isSnsByStatusAndUpdatedAt",
        "#status = :status AND #updatedAt >= :updatedAt",
        { "#status": "status", "#updatedAt": "updatedAt" },
        { ":status": "scheduled", ":updatedAt": dayjs().subtract(2, "day").toISOString() },
        1
    );
    const postItem = psotItems[0];
    const { data } = await client.v2.tweet(postItem.contentText);
    postItem.snsPostId = data.id;
    postItem.status = "posted";
    postItem.platform = "x";
    postItem.updatedAt = dayjs().toISOString();
    return postItem;
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