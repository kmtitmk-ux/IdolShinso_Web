import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    BatchWriteCommandInput,
    GetCommand,
    PutCommand,
    PutCommandInput,
    UpdateCommand,
    UpdateCommandInput,
    DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import dayjs from "dayjs";
import { v4 as uuidv4 } from 'uuid';
import * as dynamodbHelpers from '../shared/dynamodb-helpers.js';
import * as threads from './threads.js';
import * as x from './x.js';
import * as googleSheets from './google-sheets.js';
import type { Handler } from 'aws-lambda';
import type { Schema } from '../../data/resource.js';

type ThreadsMetric = {
    name: string;
    values: { value: number; }[];
};
type IsPostsItem = Schema["IsPosts"]["type"];
type SnsPostsItem = Schema["IsSns"]["type"];
type BatchItems = NonNullable<BatchWriteCommandInput["RequestItems"]>[string];

const TABLE_NAME_SNS_POSTS = process.env.TABLE_NAME_SNS_POSTS as string;
const TABLE_NAME_POSTS = process.env.TABLE_NAME_POSTS as string;
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: Handler = async (event) => {
    console.info(`EVENT: ${JSON.stringify(event)}`);
    const { procType = "" } = event;
    try {
        switch (procType) {
            case "threadsPost": {
                const postItems = await dynamodbHelpers.queryToDynamo(
                    TABLE_NAME_SNS_POSTS,
                    "isSnsByStatusAndUpdatedAt",
                    "#status = :status AND #updatedAt >= :updatedAt",
                    "#platform = :platform AND #lang = :lang AND #type = :type",
                    {
                        "#status": "status",
                        "#type": "type",
                        "#updatedAt": "updatedAt",
                        "#platform": "platform",
                        "#lang": "lang"
                    },
                    {
                        ":status": "scheduled",
                        ":type": "post",
                        ":updatedAt": dayjs().subtract(4, "day").toISOString(),
                        ":platform": "threads",
                        ":lang": "ja"
                    },
                    1
                );
                const postItem = postItems[0];
                if (!postItem || !postItem.contentText) {
                    console.info("No items.");
                    break;
                }
                const userId = await threads.getUserId();
                const snsPostId = await threads.postToThreads(userId, postItem.contentText);
                const updateParam: UpdateCommandInput = {
                    TableName: TABLE_NAME_SNS_POSTS,
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
            case "threadsTodayCheck": {
                const Items = await dynamodbHelpers.queryToDynamo(
                    TABLE_NAME_SNS_POSTS,
                    "isSnsByStatusAndUpdatedAt",
                    "#status = :status AND #updatedAt >= :updatedAt",
                    "#platform = :platform AND #lang = :lang AND #type = :type",
                    {
                        "#status": "status",
                        "#updatedAt": "updatedAt",
                        "#platform": "platform",
                        "#lang": "lang",
                        "#type": "type",
                    },
                    {
                        ":status": "posted",
                        ":updatedAt": dayjs().subtract(12, "hour").toISOString(),
                        ":platform": "threads",
                        ":lang": "ja",
                        ":type": "post"
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
                            ['likes', 'reposts', "replies"].includes(metric.name)
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
                        TableName: TABLE_NAME_SNS_POSTS,
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
                    TABLE_NAME_SNS_POSTS,
                    "isSnsByStatusAndUpdatedAt",
                    "#status = :status AND #updatedAt >= :updatedAt",
                    "#platform = :platform AND #engagementRate >= :engagementRate AND #lang = :lang AND #type = :type",
                    {
                        "#status": "status",
                        "#updatedAt": "updatedAt",
                        "#platform": "platform",
                        "#lang": "lang",
                        "#engagementRate": "engagementRate",
                        "#type": "type"
                    },
                    {
                        ":status": "posted",
                        ":updatedAt": dayjs().subtract(12, "hour").toISOString(),
                        ":platform": "threads",
                        ":lang": "ja",
                        ":engagementRate": 0.01,
                        ":type": "post"
                    },
                    10
                );
                if (Items.length === 0) {
                    console.info("No items.");
                    break;
                }
                for (const Item of Items) {
                    const { postId } = Item;
                    if (!postId) {
                        console.info("No items.");
                        continue;
                    }
                    const getParam = {
                        TableName: TABLE_NAME_POSTS,
                        Key: { id: postId }
                    };
                    const getItem = (await docClient.send(new GetCommand(getParam))).Item as IsPostsItem | undefined;
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
                        TableName: TABLE_NAME_SNS_POSTS,
                        Key: { id: Item.id },
                        UpdateExpression: "SET #status = :status",
                        ExpressionAttributeNames: { "#status": "status" },
                        ExpressionAttributeValues: { ":status": "replied" }
                    };
                    await docClient.send(new UpdateCommand(updateParam));
                }
                break;
            }
            case "threadsGetReply": {
                const [postedItems, repliedItems] = await Promise.all([
                    dynamodbHelpers.queryToDynamo(
                        TABLE_NAME_SNS_POSTS,
                        "isSnsByStatusAndUpdatedAt",
                        "#status = :status AND #updatedAt >= :updatedAt",
                        "#platform = :platform AND #lang = :lang AND #type = :type",
                        {
                            "#status": "status",
                            "#updatedAt": "updatedAt",
                            "#platform": "platform",
                            "#lang": "lang",
                            "#type": "type"
                        },
                        {
                            ":status": "posted",
                            ":updatedAt": dayjs().subtract(12, "hour").toISOString(),
                            ":platform": "threads",
                            ":lang": "ja",
                            ":type": "post"
                        },
                        10
                    ),
                    dynamodbHelpers.queryToDynamo(
                        TABLE_NAME_SNS_POSTS,
                        "isSnsByStatusAndUpdatedAt",
                        "#status = :status AND #updatedAt >= :updatedAt",
                        "#platform = :platform AND #lang = :lang AND #type = :type",
                        {
                            "#status": "status",
                            "#updatedAt": "updatedAt",
                            "#platform": "platform",
                            "#lang": "lang",
                            "#type": "type"
                        },
                        {
                            ":status": "replied",
                            ":updatedAt": dayjs().subtract(12, "hour").toISOString(),
                            ":platform": "threads",
                            ":lang": "ja",
                            ":type": "post"
                        },
                        10
                    )]);
                const snsPostsResult = [...postedItems, ...repliedItems];
                if (snsPostsResult.length === 0) {
                    console.info("No items.");
                    break;
                }
                const updateRows: [string, string, string, string, string][] = [];
                for (const Item of snsPostsResult) {
                    const { snsPostId, postId } = Item;
                    if (!postId) {
                        console.info("No items.");
                        continue;
                    }
                    const repliesRes = await threads.getPostReplies(snsPostId);
                    const getParam = {
                        TableName: TABLE_NAME_POSTS,
                        Key: { id: postId }
                    };
                    console.info("GetCommand param", getParam);
                    const { Item: getItem } = await docClient.send(new GetCommand(getParam));
                    console.info("GetCommand result", getItem);
                    if (!getItem) {
                        console.info("No items.");
                        continue;
                    }
                    const results = await Promise.all(
                        repliesRes.map(async (reply) => {
                            if (reply.text.includes("http")) {
                                return null;
                            }
                            const queryResult = await dynamodbHelpers.queryToDynamo(
                                TABLE_NAME_SNS_POSTS,
                                "isSnsByOriginalPostIdAndCreatedAt",
                                "#originalPostId = :originalPostId",
                                "#platform = :platform AND #lang = :lang AND #type = :type",
                                {
                                    "#originalPostId": "originalPostId",
                                    "#platform": "platform",
                                    "#lang": "lang",
                                    "#type": "type"
                                },
                                {
                                    ":originalPostId": reply.id,
                                    ":platform": "threads",
                                    ":lang": "ja",
                                    ":type": "reply"
                                },
                                1
                            );
                            if (queryResult.length > 0) {
                                return null;
                            }
                            const id = uuidv4();
                            updateRows.push([
                                id,
                                reply.id,
                                `タイトル : ${getItem.rewrittenTitle}\n本文 : ${Item.contentText}`,
                                reply.text,
                                `=IFERROR(SUBSTITUTE(VLOOKUP(A:A,H:I,2,false), "\\n", CHAR(10)),"")`
                            ]);
                            const now = new Date().toISOString();
                            return {
                                PutRequest: {
                                    Item: {
                                        id,
                                        contentText: reply.text,
                                        lang: "ja",
                                        originalPostId: reply.id,
                                        platform: "threads",
                                        status: "create",
                                        type: "reply",
                                        createdAt: now,
                                        updatedAt: now
                                    }
                                }
                            };
                        })
                    );
                    const batchItems: BatchItems = results.filter(
                        (item): item is NonNullable<typeof item> => item !== null
                    );
                    if (batchItems.length === 0) {
                        console.info("No new replies.");
                        continue;
                    }
                    const batchWriteResult = await dynamodbHelpers.batchWriteWithRetry(batchItems, TABLE_NAME_SNS_POSTS, 3);
                    console.info(`Inserted ${batchItems.length} new replies. ${batchWriteResult}`);
                }
                if (updateRows.length > 0) {
                    await googleSheets.appendSheetData(updateRows, 'アイドル深層_threads_reply!A1');
                }
                break;
            }
            case "threadsCreateReply": {
                const data = await googleSheets.getSheetData("アイドル深層_threads_reply!A2:E");
                const failedRows: typeof data = [];
                for (const row of data ?? []) {
                    const [id, _snsPostId, _postContent, _content, replyContent] = row;
                    if (!id || !replyContent) {
                        console.warn("Skipping row due to missing required fields:", row);
                        continue;
                    }
                    const now = dayjs().toISOString();
                    const updateParam: UpdateCommandInput = {
                        TableName: TABLE_NAME_SNS_POSTS,
                        Key: { id },
                        UpdateExpression: "SET #replyContent = :replyContent, #createdAt = :createdAt, #updatedAt = :updatedAt, #status = :status",
                        ExpressionAttributeNames: {
                            "#replyContent": "replyContent",
                            "#createdAt": "createdAt",
                            "#updatedAt": "updatedAt",
                            "#status": "status"
                        },
                        ExpressionAttributeValues: {
                            ":replyContent": replyContent,
                            ":createdAt": now,
                            ":updatedAt": now,
                            ":status": "scheduled"
                        },
                        ConditionExpression: "attribute_exists(id)"
                    };
                    console.info("UpdateCommand param", updateParam);
                    try {
                        await docClient.send(new UpdateCommand(updateParam));
                    } catch (error) {
                        console.error(`Failed to update item ${id}`, error);
                        failedRows.push(row);
                    }
                }
                if (failedRows.length > 0) {
                    console.error(`${failedRows.length} rows failed to update; skipping sheet clear to allow retry.`);
                    // 失敗行だけ残す/別シートに退避する、などの方針をここで
                } else {
                    await googleSheets.clearSheetData("アイドル深層_threads_reply!A2:E");
                }
                break;
            }
            case "threadsReplyPost": {
                const Items = await dynamodbHelpers.queryToDynamo(
                    TABLE_NAME_SNS_POSTS,
                    "isSnsByStatusAndUpdatedAt",
                    "#status = :status AND #updatedAt >= :updatedAt",
                    "#platform = :platform AND #lang = :lang AND attribute_exists(#replyContent) and #type = :type",
                    {
                        "#status": "status",
                        "#updatedAt": "updatedAt",
                        "#platform": "platform",
                        "#lang": "lang",
                        "#replyContent": "replyContent",
                        "#type": "type"
                    },
                    {
                        ":status": "scheduled",
                        ":updatedAt": dayjs().subtract(12, "hour").toISOString(),
                        ":platform": "threads",
                        ":lang": "ja",
                        ":type": "reply"
                    },
                    10
                );
                if (!Items.length) {
                    console.info("No items.");
                    break;
                }
                const userId = await threads.getUserId();
                for (const Item of Items) {
                    try {
                        await threads.replyToThreads(userId, Item.originalPostId, Item.replyContent);
                    } catch (error) {
                        console.error(`[reply failed, not yet posted] item ${Item.id}`, error);
                        continue;
                    }
                    try {
                        const updateParam: UpdateCommandInput = {
                            TableName: TABLE_NAME_SNS_POSTS,
                            Key: { id: Item.id },
                            UpdateExpression: "SET #status = :status",
                            ExpressionAttributeNames: { "#status": "status" },
                            ExpressionAttributeValues: { ":status": "replied" }
                        };
                        await docClient.send(new UpdateCommand(updateParam));
                        break;
                    } catch (error) {
                        console.error(`[posted but status update failed - risk of duplicate reply next run] item ${Item.id}`, error);
                        continue;
                    }
                }
                break;
            }
            case "threadsCheck": {
                // 投稿後のエンゲージメントをチェック
                const [postedItems, repliedItems] = await Promise.all([
                    dynamodbHelpers.queryToDynamo(
                        TABLE_NAME_SNS_POSTS,
                        "isSnsByStatusAndUpdatedAt",
                        "#status = :status AND #updatedAt >= :updatedAt",
                        "#platform = :platform AND #lang = :lang AND attribute_not_exists(#crossPosted) AND #type = :type",
                        {
                            "#status": "status",
                            "#updatedAt": "updatedAt",
                            "#platform": "platform",
                            "#lang": "lang",
                            "#crossPosted": "crossPosted",
                            "#type": "type"
                        },
                        {
                            ":status": "posted",
                            ":updatedAt": dayjs().subtract(3, "day").toISOString(),
                            ":platform": "threads",
                            ":lang": "ja",
                            ":type": "post"
                        },
                        30
                    ),
                    dynamodbHelpers.queryToDynamo(
                        TABLE_NAME_SNS_POSTS,
                        "isSnsByStatusAndUpdatedAt",
                        "#status = :status AND #updatedAt >= :updatedAt",
                        "#platform = :platform AND #lang = :lang AND attribute_not_exists(#crossPosted) AND #type = :type",
                        {
                            "#status": "status",
                            "#updatedAt": "updatedAt",
                            "#platform": "platform",
                            "#lang": "lang",
                            "#crossPosted": "crossPosted",
                            "#type": "type",
                        },
                        {
                            ":status": "replied",
                            ":updatedAt": dayjs().subtract(3, "day").toISOString(),
                            ":platform": "threads",
                            ":lang": "ja",
                            ":type": "post"
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
                            TableName: TABLE_NAME_SNS_POSTS,
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
                            const putParam: PutCommandInput = {
                                TableName: TABLE_NAME_SNS_POSTS,
                                Item: {
                                    ...item,
                                    id: uuidv4(),
                                    platform: "x",
                                    snsPostId: "",
                                    engagementRate: 0,
                                    status: "scheduled",
                                    type: "post",
                                    updatedAt: dayjs().toISOString(),
                                }
                            };
                            console.info("PutCommand param", putParam);
                            const putResult = await docClient.send(new PutCommand(putParam));
                            console.info("PutCommand result", putResult);
                            // threads側のcrossPostedを更新
                            const crossPostedUpdateParam: UpdateCommandInput = {
                                TableName: TABLE_NAME_SNS_POSTS,
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
            // X のユーザー情報を取得して確認
            case "xGetUser": {
                await x.getUser();
                break;
            }
            // X のいいね投稿を取得し、未登録のものを DynamoDB と Google Sheets に保存
            case "xGetLikes": {
                const likedPosts = await x.getLikedPosts();
                console.info("Liked Posts:", likedPosts);
                const updateRows = [];
                for (const likedPost of likedPosts) {
                    // 同一投稿が既に DynamoDB に存在するか確認（重複登録防止）
                    const Items = await dynamodbHelpers.queryToDynamo(
                        TABLE_NAME_SNS_POSTS,
                        "isOriginalPostIdAndCreatedAt",
                        "#originalPostId = :originalPostId",
                        "#platform = :platform AND #type = :type",
                        {
                            "#originalPostId": "originalPostId",
                            "#platform": "platform",
                            "#type": "type"
                        },
                        {
                            ":originalPostId": likedPost.id,
                            ":platform": "threads",
                            ":type": "post"
                        },
                        1
                    ) as SnsPostsItem[];
                    // 未登録の場合のみ DynamoDB に保存
                    if (Items.length === 0) {
                        const putParam: PutCommandInput = {
                            TableName: TABLE_NAME_SNS_POSTS,
                            Item: {
                                id: uuidv4(),
                                content: likedPost.text,
                                lang: "ja",
                                originalPostId: likedPost.id,
                                platform: "threads",
                                status: "create",
                                type: "post",
                                createdAt: dayjs().toISOString(),
                                updatedAt: dayjs().toISOString(),
                            }
                        };
                        console.info("Put post param", putParam);
                        await docClient.send(new PutCommand(putParam));
                        const { Item = {} } = putParam;
                        // Google Sheets に追記する行データを組み立て
                        updateRows.push([
                            Item.id,
                            Item.originalPostId,
                            Item.content,
                            `https://x.com/${likedPost.author_id}/status/${Item.originalPostId}`,
                            "",
                            ""
                        ]);
                    }
                }
                if (updateRows.length) {
                    await googleSheets.appendSheetData(updateRows, "アイドル深層_X!A1");
                }
                break;
            }
            case "xPost": {
                const postItems = await dynamodbHelpers.queryToDynamo(
                    TABLE_NAME_SNS_POSTS,
                    "isSnsByStatusAndUpdatedAt",
                    "#status = :scheduled AND #updatedAt >= :updatedAt",
                    "#platform = :platform AND #lang = :lang AND #type = :type",
                    {
                        "#status": "status",
                        "#updatedAt": "updatedAt",
                        "#platform": "platform",
                        "#lang": "lang",
                        "#type": "type"
                    },
                    {
                        ":scheduled": "scheduled",
                        ":updatedAt": dayjs().subtract(4, "day").toISOString(),
                        ":platform": "x",
                        ":lang": "ja",
                        ":type": "post"
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
                    TableName: TABLE_NAME_SNS_POSTS,
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
            case "xCheck": {
                // 投稿後のエンゲージメントをチェック
                const [postedItems, repliedItems] = await Promise.all([
                    dynamodbHelpers.queryToDynamo(
                        TABLE_NAME_SNS_POSTS,
                        "isSnsByStatusAndUpdatedAt",
                        "#status = :status AND #updatedAt >= :updatedAt",
                        "#platform = :platform AND #lang = :lang AND #type = :type",
                        {
                            "#status": "status",
                            "#updatedAt": "updatedAt",
                            "#platform": "platform",
                            "#lang": "lang",
                            "#type": "type"
                        },
                        {
                            ":status": "posted",
                            ":updatedAt": dayjs().subtract(3, "day").toISOString(),
                            ":platform": "x",
                            ":lang": "ja",
                            ":type": "post"
                        },
                        15
                    ),
                    dynamodbHelpers.queryToDynamo(
                        TABLE_NAME_SNS_POSTS,
                        "isSnsByStatusAndUpdatedAt",
                        "#status = :status AND #updatedAt >= :updatedAt",
                        "#platform = :platform AND #lang = :lang AND #type = :type",
                        {
                            "#status": "status",
                            "#updatedAt": "updatedAt",
                            "#platform": "platform",
                            "#lang": "lang",
                            "#type": "type"
                        },
                        {
                            ":status": "replied",
                            ":updatedAt": dayjs().subtract(3, "day").toISOString(),
                            ":platform": "x",
                            ":lang": "ja",
                            ":type": "post"
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
                        if (item && item.postId) {
                            const getParam = {
                                TableName: TABLE_NAME_POSTS,
                                Key: { id: item.postId }
                            };
                            console.info("GetCommand param", getParam);
                            const { Item: getItem } = await docClient.send(new GetCommand(getParam));
                            console.info("GetCommand result", getItem);
                            if (getItem && item.status === "posted") {
                                updateRows.push([
                                    item.id,
                                    item.snsPostId,
                                    item.contentText,
                                    `https://x.com/IdolShinso/status/${item.snsPostId}`,
                                    "",
                                    `${getItem.rewrittenTitle}\n\nhttps://geinouwasa.com/posts/${getItem.slug}`
                                ]);
                            }
                            const updateParam: UpdateCommandInput = {
                                TableName: TABLE_NAME_SNS_POSTS,
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
                if (updateRows.length) {
                    await googleSheets.appendSheetData(updateRows, 'アイドル深層_X!A1');
                }
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
