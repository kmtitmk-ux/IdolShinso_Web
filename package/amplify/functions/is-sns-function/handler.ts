import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    GetCommand,
    PutCommand,
    PutCommandInput,
    QueryCommand,
    QueryCommandInput,
    UpdateCommand,
    UpdateCommandInput,
    DynamoDBDocumentClient
} from "@aws-sdk/lib-dynamodb";
import dayjs from "dayjs";
import { v4 as uuidv4 } from 'uuid';
import * as threads from './threads';
import * as x from './x';
import type { Handler } from 'aws-lambda';

const TABLE_ID = process.env.TABLE_ID as string;
const TABLE_NAME_IS_SNS = `IsSns-${TABLE_ID}`;
const TABLE_NAME_IS_POSTS = `IsPosts-${TABLE_ID}`;
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));


export const handler: Handler = async (event) => {
    console.info(`EVENT: ${JSON.stringify(event)}`);
    try {
        switch (event.procType) {
            case "threadsPost": {
                const postItems = await queryToDynamo(
                    TABLE_NAME_IS_SNS,
                    "isSnsByStatusAndUpdatedAt",
                    "#status = :status AND #updatedAt >= :updatedAt",
                    "#lang = :ja",
                    {
                        "#status": "status",
                        "#updatedAt": "updatedAt",
                        "#lang": "lang"
                    },
                    {
                        ":status": "scheduled",
                        ":updatedAt": dayjs().subtract(4, "day").toISOString(),
                        ":ja": "ja"
                    },
                    1
                );
                if (postItems.length === 0) {
                    console.info("No items.");
                    break;
                }
                const postItem = postItems[0];
                const userId = await threads.getUserId();
                const snsPostId = await threads.postToThreads(userId, postItem.contentText);
                const updateParam: UpdateCommandInput = {
                    TableName: TABLE_NAME_IS_SNS,
                    Key: { id: postItem.id },
                    UpdateExpression: "SET #snsPostId = :snsPostId, #platform = :threads, #status = :posted",
                    ExpressionAttributeNames: {
                        "#snsPostId": "snsPostId",
                        "#platform": "platform",
                        "#status": "status"
                    },
                    ExpressionAttributeValues: {
                        ":snsPostId": snsPostId,
                        ":threads": "threads",
                        ":posted": "posted"
                    }
                };
                console.info("UpdateCommand param", updateParam);
                await docClient.send(new UpdateCommand(updateParam));
                break;
            }
            case "xPost": {
                const postItems = await queryToDynamo(
                    TABLE_NAME_IS_SNS,
                    "isSnsByStatusAndUpdatedAt",
                    "#status = :scheduled AND #updatedAt >= :updatedAt",
                    "#platform = :x AND #lang = :ja",
                    {
                        "#status": "status",
                        "#updatedAt": "updatedAt",
                        "#platform": "platform",
                        "#lang": "lang"
                    },
                    {
                        ":scheduled": "scheduled",
                        ":updatedAt": dayjs().subtract(4, "day").toISOString(),
                        ":x": "x",
                        ":ja": "ja"
                    },
                    1
                );
                if (postItems.length === 0) {
                    console.info("No items.");
                    break;
                }
                const postItem = postItems[0];
                const snsPostId = await x.postToX(postItem.contentText);
                const updateParam: UpdateCommandInput = {
                    TableName: TABLE_NAME_IS_SNS,
                    Key: { id: postItem.id },
                    UpdateExpression: "SET #engagementRate = :engagementRate, #status = :posted, #snsPostId = :snsPostId, #updatedAt = :now",
                    ExpressionAttributeNames: {
                        "#engagementRate": "engagementRate",
                        "#status": "status",
                        "#snsPostId": "snsPostId",
                        "#updatedAt": "updatedAt"
                    },
                    ExpressionAttributeValues: {
                        ":engagementRate": 0,
                        ":posted": "posted",
                        ":snsPostId": snsPostId,
                        ":now": dayjs().toISOString()
                    }
                };
                console.info("UpdateCommand param", updateParam);
                await docClient.send(new UpdateCommand(updateParam));
                break;
            }
            case "threadsCheck": {
                // 投稿後のエンゲージメントをチェック
                const [postedItems, repliedItems] = await Promise.all([
                    queryToDynamo(
                        TABLE_NAME_IS_SNS,
                        "isSnsByStatusAndUpdatedAt",
                        "#status = :status AND #updatedAt >= :updatedAt",
                        "#platform = :threads AND #lang = :ja AND attribute_not_exists(#crossPosted)",
                        {
                            "#status": "status",
                            "#updatedAt": "updatedAt",
                            "#platform": "platform",
                            "#lang": "lang",
                            "#crossPosted": "crossPosted"
                        },
                        {
                            ":status": "posted",
                            ":updatedAt": dayjs().subtract(7, "day").toISOString(),
                            ":threads": "threads",
                            ":ja": "ja"
                        },
                        35
                    ),
                    queryToDynamo(
                        TABLE_NAME_IS_SNS,
                        "isSnsByStatusAndUpdatedAt",
                        "#status = :status AND #updatedAt >= :updatedAt",
                        "#platform = :threads AND #lang = :ja AND attribute_not_exists(#crossPosted)",
                        {
                            "#status": "status",
                            "#updatedAt": "updatedAt",
                            "#platform": "platform",
                            "#lang": "lang",
                            "#crossPosted": "crossPosted"
                        },
                        {
                            ":status": "replied",
                            ":updatedAt": dayjs().subtract(7, "day").toISOString(),
                            ":threads": "threads",
                            ":ja": "ja"
                        },
                        35
                    )
                ]);
                const checkItems = [
                    ...postedItems,
                    ...repliedItems
                ];
                if (checkItems.length === 0) {
                    console.info("No items.");
                    break;
                }
                for (const item of checkItems) {
                    try {
                        const insights = await threads.getPostInsights(item.snsPostId);
                        const metrics = insights.data ?? [];
                        const engagementCount = metrics
                            .filter((metric: any) =>
                                ['likes', 'reposts'].includes(metric.name)
                            )
                            .reduce((sum: number, metric: any) => {
                                return sum + (metric?.values?.[0]?.value ?? 0);
                            }, 0);
                        const views = metrics.find(
                            (metric: any) => metric.name === "views"
                        )?.values?.[0]?.value ?? 0;
                        const engagementRate = views > 0 ? engagementCount / views : 0;
                        const updateParam: UpdateCommandInput = {
                            TableName: TABLE_NAME_IS_SNS,
                            Key: { id: item.id },
                            UpdateExpression: "SET #engagementRate = :engagementRate",
                            ExpressionAttributeNames: {
                                "#engagementRate": "engagementRate"
                            },
                            ExpressionAttributeValues: {
                                ":engagementRate": engagementRate
                            }
                        };
                        console.info("UpdateCommand param", updateParam);
                        await docClient.send(new UpdateCommand(updateParam));
                        if (engagementRate >= 0.01 && !item.crossPosted) {
                            const newItem = { ...item };
                            newItem.id = uuidv4();
                            newItem.platform = "x";
                            newItem.snsPostId = "";
                            newItem.engagementRate = 0;
                            newItem.status = "scheduled";
                            newItem.updatedAt = dayjs().toISOString();
                            await putToDynamo(newItem);
                            const crossPostedUpdateParam: UpdateCommandInput = {
                                TableName: TABLE_NAME_IS_SNS,
                                Key: { id: item.id },
                                UpdateExpression: "SET #crossPosted = :crossPosted",
                                ExpressionAttributeNames: {
                                    "#crossPosted": "crossPosted"
                                },
                                ExpressionAttributeValues: {
                                    ":crossPosted": true
                                }
                            };
                            console.info("UpdateCommand param", crossPostedUpdateParam);
                            await docClient.send(new UpdateCommand(crossPostedUpdateParam));
                        }
                    } catch (error) {
                        console.warn(error);
                    }
                }
                break;
            }
            case "xCheck": {
                // 投稿後のエンゲージメントをチェック
                const [postedItems, repliedItems] = await Promise.all([
                    queryToDynamo(
                        TABLE_NAME_IS_SNS,
                        "isSnsByStatusAndUpdatedAt",
                        "#status = :status AND #updatedAt >= :updatedAt",
                        "#platform = :x AND #lang = :ja",
                        {
                            "#status": "status",
                            "#updatedAt": "updatedAt",
                            "#platform": "platform",
                            "#lang": "lang"
                        },
                        {
                            ":status": "posted",
                            ":updatedAt": dayjs().subtract(7, "day").toISOString(),
                            ":x": "x",
                            ":ja": "ja"
                        },
                        35
                    ),
                    queryToDynamo(
                        TABLE_NAME_IS_SNS,
                        "isSnsByStatusAndUpdatedAt",
                        "#status = :status AND #updatedAt >= :updatedAt",
                        "#platform = :x AND #lang = :ja",
                        {
                            "#status": "status",
                            "#updatedAt": "updatedAt",
                            "#platform": "platform",
                            "#lang": "lang"
                        },
                        {
                            ":status": "replied",
                            ":updatedAt": dayjs().subtract(7, "day").toISOString(),
                            ":x": "x",
                            ":ja": "ja"
                        },
                        35
                    )
                ]);
                const checkItems = [
                    ...postedItems,
                    ...repliedItems
                ];
                const ids: string[] = [];
                for (const v of checkItems) {
                    if (v.snsPostId) ids.push(v.snsPostId);
                }
                if (ids.length === 0) {
                    console.info("No items.");
                    break;
                }
                const insightsRes = await x.getPostInsights(ids);
                for (const data of insightsRes.data) {
                    try {
                        const { like_count, retweet_count, impression_count } = data.public_metrics;
                        const engagementCount = like_count + retweet_count;
                        const engagementRate = impression_count > 0 ? engagementCount / impression_count : 0;
                        // エンゲージメントが一定数を超えたらリプライを投稿
                        const snsPostId = data.id;
                        const item = checkItems.find(item => item.snsPostId === snsPostId);
                        const postId = item?.postId ?? "";
                        if (!postId) continue;
                        // const { Item: getResult } = await docClient.send(new GetCommand({
                        //     TableName: TABLE_NAME_IS_POSTS,
                        //     Key: { id: postId }
                        // }));
                        // console.info("GetCommand result", getResult);
                        // // リプライ実行
                        // await x.replyToX(`${getResult?.rewrittenTitle}\n\nhttps://geinouwasa.com/posts/${getResult?.slug}`, snsPostId);
                        if (item?.id) {
                            const updateParam: UpdateCommandInput = {
                                TableName: TABLE_NAME_IS_SNS,
                                Key: { id: item.id },
                                UpdateExpression: "SET #engagementRate = :engagementRate, #status = :replied",
                                ExpressionAttributeNames: {
                                    "#engagementRate": "engagementRate",
                                    "#status": "status",
                                },
                                ExpressionAttributeValues: {
                                    ":engagementRate": engagementRate,
                                    ":replied": "replied"
                                }
                            };
                            await docClient.send(new UpdateCommand(updateParam));
                        }
                    } catch (error) {
                        console.warn(error);
                    }
                }
                break;
            }
            case "threadsReply": {
                const postItems = await queryToDynamo(
                    TABLE_NAME_IS_SNS,
                    "isSnsByStatusAndUpdatedAt",
                    "#status = :status AND #updatedAt >= :updatedAt",
                    "#platform = :threads AND #engagementRate >= :engagementRate AND #lang = :ja",
                    {
                        "#status": "status",
                        "#updatedAt": "updatedAt",
                        "#platform": "platform",
                        "#engagementRate": "engagementRate",
                        "#lang": "lang"
                    },
                    {
                        ":status": "posted",
                        ":updatedAt": dayjs().subtract(2, "day").toISOString(),
                        ":threads": "threads",
                        ":engagementRate": 0.01,
                        ":ja": "ja"
                    },
                    1
                );
                if (postItems.length === 0) {
                    console.info("No items.");
                    break;
                }
                const postItem = postItems[0];
                const postId = postItem.postId;
                const { Item: getResult } = await docClient.send(new GetCommand({
                    TableName: TABLE_NAME_IS_POSTS,
                    Key: { id: postId }
                }));
                console.info("GetCommand result", getResult);
                const postText = getResult?.rewrittenTitle;
                const userId = await threads.getUserId();
                await threads.replyToThreads(
                    userId,
                    postItem.snsPostId,
                    `${postText}\n\nhttps://geinouwasa.com/posts/${getResult?.slug}`
                );
                const updateParam: UpdateCommandInput = {
                    TableName: TABLE_NAME_IS_SNS,
                    Key: { id: postItem.id },
                    UpdateExpression: "SET #status = :replied",
                    ExpressionAttributeNames: { "#status": "status" },
                    ExpressionAttributeValues: { ":replied": "replied" }
                };
                await docClient.send(new UpdateCommand(updateParam));
                break;
            }
            default:
                throw new Error(`Unsupported procType: ${event.procType}`);
        }
    } catch (error: any) {
        console.error(error);
        if (error?.response?.data) {
            console.info(JSON.stringify(error.response?.data, null, 2));
        }
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


// 
async function queryToDynamo(
    TableName: string,
    IndexName: string | undefined,
    KeyConditionExpression: string,
    FilterExpression: string | undefined,
    ExpressionAttributeNames: Record<string, any>,
    ExpressionAttributeValues: Record<string, any>,
    Limit: number
) {
    console.info("queryToDynamo param", { TableName, IndexName, KeyConditionExpression, FilterExpression, ExpressionAttributeNames, ExpressionAttributeValues });
    const outParam = [];
    const param: QueryCommandInput = {
        TableName,
        IndexName,
        KeyConditionExpression,
        FilterExpression,
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
    console.info("queryToDynamo result", outParam);
    return outParam;
}