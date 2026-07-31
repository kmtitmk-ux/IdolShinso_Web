import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    GetCommand,
    PutCommand,
    PutCommandInput,
    UpdateCommand,
    UpdateCommandInput,
    DynamoDBDocumentClient
} from "@aws-sdk/lib-dynamodb";
import dayjs from "dayjs";
import { v4 as uuidv4 } from 'uuid';
import * as dynamodbHelpers from '../shared/dynamodb-helpers.js';
import * as threads from './threads';
import * as x from './x';
import * as googleSheets from './googleSheets';
import type { Handler } from 'aws-lambda';
import type { Schema } from '../../data/resource';

type ThreadsMetric = {
    name: string;
    values: { value: number; }[];
};
type IsPostsItem = Schema["IsPosts"]["type"];

const TABLE_ID = process.env.TABLE_ID as string;
const TABLE_NAME_IS_SNS = `IsSns-${TABLE_ID}`;
const TABLE_NAME_IS_POSTS = `IsPosts-${TABLE_ID}`;
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: Handler = async (event) => {
    console.info(`EVENT: ${JSON.stringify(event)}`);
    const { procType = "" } = event;
    try {
        switch (procType) {
            case "threadsPost": {
                const postItems = await dynamodbHelpers.queryToDynamo(
                    TABLE_NAME_IS_SNS,
                    "isSnsByStatusAndUpdatedAt",
                    "#status = :status AND #updatedAt >= :updatedAt",
                    "#platform = :platform AND #lang = :lang",
                    {
                        "#status": "status",
                        "#updatedAt": "updatedAt",
                        "#platform": "platform",
                        "#lang": "lang"
                    },
                    {
                        ":status": "scheduled",
                        ":updatedAt": dayjs().subtract(4, "day").toISOString(),
                        ":platform": "threads",
                        ":lang": "ja"
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
                    UpdateExpression: "SET #snsPostId = :snsPostId, #status = :posted, #updatedAt = :updatedAt",
                    ExpressionAttributeNames: {
                        "#snsPostId": "snsPostId",
                        "#status": "status",
                        "#updatedAt": "updatedAt"
                    },
                    ExpressionAttributeValues: {
                        ":snsPostId": snsPostId,
                        ":posted": "posted",
                        ":updatedAt": dayjs().toISOString()
                    }
                };
                console.info("UpdateCommand param", updateParam);
                await docClient.send(new UpdateCommand(updateParam));
                break;
            }
            case "xPost": {
                const postItems = await dynamodbHelpers.queryToDynamo(
                    TABLE_NAME_IS_SNS,
                    "isSnsByStatusAndUpdatedAt",
                    "#status = :scheduled AND #updatedAt >= :updatedAt",
                    "#platform = :platform AND #lang = :lang",
                    {
                        "#status": "status",
                        "#updatedAt": "updatedAt",
                        "#platform": "platform",
                        "#lang": "lang"
                    },
                    {
                        ":scheduled": "scheduled",
                        ":updatedAt": dayjs().subtract(4, "day").toISOString(),
                        ":platform": "x",
                        ":lang": "ja"
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
                    UpdateExpression: "SET #status = :posted, #snsPostId = :snsPostId, #updatedAt = :updatedAt",
                    ExpressionAttributeNames: {
                        "#status": "status",
                        "#snsPostId": "snsPostId",
                        "#updatedAt": "updatedAt"
                    },
                    ExpressionAttributeValues: {
                        ":posted": "posted",
                        ":snsPostId": snsPostId,
                        ":updatedAt": dayjs().toISOString()
                    }
                };
                console.info("UpdateCommand param", updateParam);
                await docClient.send(new UpdateCommand(updateParam));
                break;
            }
            case "threadsTodayCheck": {
                const Items = await dynamodbHelpers.queryToDynamo(
                    TABLE_NAME_IS_SNS,
                    "isSnsByStatusAndUpdatedAt",
                    "#status = :status AND #updatedAt >= :updatedAt",
                    "#platform = :platform AND #lang = :lang",
                    {
                        "#status": "status",
                        "#updatedAt": "updatedAt",
                        "#platform": "platform",
                        "#lang": "lang",
                    },
                    {
                        ":status": "posted",
                        ":updatedAt": dayjs().subtract(12, "hour").toISOString(),
                        ":platform": "threads",
                        ":lang": "ja"
                    },
                    10
                );
                if (Items.length === 0) {
                    console.info("No items.");
                    break;
                }
                for (const Item of Items) {
                    const insights = await threads.getPostInsights(Item.snsPostId);
                    const metrics = insights.data ?? [];
                    const engagementCount = metrics
                        .filter((metric: ThreadsMetric) =>
                            ['likes', 'reposts'].includes(metric.name)
                        )
                        .reduce((sum: number, metric: ThreadsMetric) => {
                            return sum + (metric?.values?.[0]?.value ?? 0);
                        }, 0);
                    const views = metrics.find(
                        (metric: ThreadsMetric) => metric.name === "views"
                    )?.values?.[0]?.value ?? 0;
                    let engagementRate = 0;
                    if (views > 0) {
                        engagementRate = engagementCount / views;
                    } else if (engagementCount > 0) {
                        engagementRate = 0.02;
                    }
                    const updateParam: UpdateCommandInput = {
                        TableName: TABLE_NAME_IS_SNS,
                        Key: { id: Item.id },
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
                }
                break;
            }
            case "threadsReplyUrl": {
                const Items = await dynamodbHelpers.queryToDynamo(
                    TABLE_NAME_IS_SNS,
                    "isSnsByStatusAndUpdatedAt",
                    "#status = :status AND #updatedAt >= :updatedAt",
                    "#platform = :platform AND #engagementRate >= :engagementRate AND #lang = :lang",
                    {
                        "#status": "status",
                        "#updatedAt": "updatedAt",
                        "#platform": "platform",
                        "#lang": "lang",
                        "#engagementRate": "engagementRate"
                    },
                    {
                        ":status": "posted",
                        ":updatedAt": dayjs().subtract(12, "hour").toISOString(),
                        ":platform": "threads",
                        ":lang": "ja",
                        ":engagementRate": 0.01
                    },
                    10
                );
                if (!Items.length) {
                    console.info("No items.");
                    break;
                }
                for (const Item of Items) {
                    const getItem = (await docClient.send(new GetCommand({
                        TableName: TABLE_NAME_IS_POSTS,
                        Key: { id: Item.postId }
                    }))).Item as IsPostsItem | undefined;
                    console.info("GetCommand result", getItem);
                    if (!getItem) {
                        console.warn(`No post item found for postId: ${Item.postId}`);
                        continue;
                    }
                    const postText = getItem.rewrittenTitle;
                    const userId = await threads.getUserId();
                    await threads.replyToThreads(
                        userId,
                        Item.snsPostId,
                        `${postText}\n\nhttps://geinouwasa.com/posts/${getItem?.slug}`
                    );
                    const updateParam: UpdateCommandInput = {
                        TableName: TABLE_NAME_IS_SNS,
                        Key: { id: Item.id },
                        UpdateExpression: "SET #status = :status",
                        ExpressionAttributeNames: { "#status": "status" },
                        ExpressionAttributeValues: { ":status": "replied" }
                    };
                    await docClient.send(new UpdateCommand(updateParam));
                }
                break;
            }
            case "threadsCheck": {
                // 投稿後のエンゲージメントをチェック
                const [postedItems, repliedItems] = await Promise.all([
                    dynamodbHelpers.queryToDynamo(
                        TABLE_NAME_IS_SNS,
                        "isSnsByStatusAndUpdatedAt",
                        "#status = :status AND #updatedAt >= :updatedAt",
                        "#platform = :platform AND #lang = :lang AND attribute_not_exists(#crossPosted)",
                        {
                            "#status": "status",
                            "#updatedAt": "updatedAt",
                            "#platform": "platform",
                            "#lang": "lang",
                            "#crossPosted": "crossPosted"
                        },
                        {
                            ":status": "posted",
                            ":updatedAt": dayjs().subtract(3, "day").toISOString(),
                            ":platform": "threads",
                            ":lang": "ja"
                        },
                        30
                    ),
                    dynamodbHelpers.queryToDynamo(
                        TABLE_NAME_IS_SNS,
                        "isSnsByStatusAndUpdatedAt",
                        "#status = :status AND #updatedAt >= :updatedAt",
                        "#platform = :platform AND #lang = :lang AND attribute_not_exists(#crossPosted)",
                        {
                            "#status": "status",
                            "#updatedAt": "updatedAt",
                            "#platform": "platform",
                            "#lang": "lang",
                            "#crossPosted": "crossPosted"
                        },
                        {
                            ":status": "replied",
                            ":updatedAt": dayjs().subtract(3, "day").toISOString(),
                            ":platform": "threads",
                            ":lang": "ja"
                        },
                        30
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
                            .filter((metric: ThreadsMetric) =>
                                ['likes', 'reposts'].includes(metric.name)
                            )
                            .reduce((sum: number, metric: ThreadsMetric) => {
                                return sum + (metric?.values?.[0]?.value ?? 0);
                            }, 0);
                        const views = metrics.find(
                            (metric: ThreadsMetric) => metric.name === "views"
                        )?.values?.[0]?.value ?? 0;
                        let engagementRate = 0;
                        if (views > 0) {
                            engagementRate = engagementCount / views;
                        } else if (engagementCount > 0) {
                            engagementRate = 0.02;
                        }
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
                        if (engagementRate >= 0.02 && !item.crossPosted) {
                            const newItem = { ...item };
                            newItem.id = uuidv4();
                            newItem.platform = "x";
                            newItem.snsPostId = "";
                            newItem.engagementRate = 0;
                            newItem.status = "scheduled";
                            newItem.updatedAt = dayjs().toISOString();
                            const putParam: PutCommandInput = {
                                TableName: TABLE_NAME_IS_SNS,
                                Item: newItem
                            };
                            console.info("PutCommand param", putParam);
                            const putResult = await docClient.send(new PutCommand(putParam));
                            console.info("PutCommand result", putResult);
                            // threads側のcrossPostedを更新
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
                    dynamodbHelpers.queryToDynamo(
                        TABLE_NAME_IS_SNS,
                        "isSnsByStatusAndUpdatedAt",
                        "#status = :status AND #updatedAt >= :updatedAt",
                        "#platform = :platform AND #lang = :lang",
                        {
                            "#status": "status",
                            "#updatedAt": "updatedAt",
                            "#platform": "platform",
                            "#lang": "lang"
                        },
                        {
                            ":status": "posted",
                            ":updatedAt": dayjs().subtract(3, "day").toISOString(),
                            ":platform": "x",
                            ":lang": "ja"
                        },
                        15
                    ),
                    dynamodbHelpers.queryToDynamo(
                        TABLE_NAME_IS_SNS,
                        "isSnsByStatusAndUpdatedAt",
                        "#status = :status AND #updatedAt >= :updatedAt",
                        "#platform = :platform AND #lang = :lang",
                        {
                            "#status": "status",
                            "#updatedAt": "updatedAt",
                            "#platform": "platform",
                            "#lang": "lang"
                        },
                        {
                            ":status": "replied",
                            ":updatedAt": dayjs().subtract(3, "day").toISOString(),
                            ":platform": "x",
                            ":lang": "ja"
                        },
                        15
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
                const updateRows = [];
                const insightsRes = await x.getPostInsights(ids);
                for (const data of insightsRes.data) {
                    try {
                        const { like_count, retweet_count, impression_count } = data.public_metrics;
                        const engagementCount = like_count + retweet_count;
                        const engagementRate = impression_count > 0 ? engagementCount / impression_count : 0;
                        const snsPostId = data.id;
                        const item = checkItems.find(item => item.snsPostId === snsPostId);
                        if (item) {
                            const { Item: getItem } = await docClient.send(new GetCommand({
                                TableName: TABLE_NAME_IS_POSTS,
                                Key: { id: item.postId }
                            }));
                            console.info("GetCommand result", getItem);
                            if (getItem) {
                                updateRows.push([
                                    item.id,
                                    item.snsPostId,
                                    item.contentText,
                                    `${getItem.rewrittenTitle}\n\nhttps://geinouwasa.com/posts/${getItem.slug}`,
                                    `https://x.com/IdolShinso/status/${item.snsPostId}`
                                ]);
                            }
                            const updateParam: UpdateCommandInput = {
                                TableName: TABLE_NAME_IS_SNS,
                                Key: { id: item.id },
                                UpdateExpression: "SET #engagementRate = :engagementRate, #status = :status",
                                ExpressionAttributeNames: {
                                    "#engagementRate": "engagementRate",
                                    "#status": "status",
                                },
                                ExpressionAttributeValues: {
                                    ":engagementRate": engagementRate,
                                    ":status": "replied"
                                }
                            };
                            await docClient.send(new UpdateCommand(updateParam));
                        }
                    } catch (error) {
                        console.warn(error);
                    }
                }
                await googleSheets.appendData(updateRows);
                break;
            }
            default:
                throw new Error(`Unsupported procType: ${procType}`);
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
