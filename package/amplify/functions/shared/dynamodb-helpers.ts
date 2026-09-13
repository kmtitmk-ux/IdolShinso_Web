import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    QueryCommand,
    QueryCommandInput,
    ScanCommand,
    ScanCommandInput,
    BatchWriteCommand,
    BatchWriteCommandInput,
    DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
type BatchItems = NonNullable<BatchWriteCommandInput["RequestItems"]>[string];

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function queryToDynamo(
    TableName: string,
    IndexName: string | undefined,
    KeyConditionExpression: string,
    FilterExpression: string | undefined,
    ExpressionAttributeNames: Record<string, string>,
    ExpressionAttributeValues: Record<string, NativeAttributeValue>,
    Limit: number,
    ScanIndexForward?: boolean,
    ProjectionExpression?: string,
) {
    console.info("queryToDynamo param", { TableName, IndexName, KeyConditionExpression, FilterExpression, ExpressionAttributeNames, ExpressionAttributeValues });
    const result = [];
    const param: QueryCommandInput = {
        TableName,
        IndexName,
        KeyConditionExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
    };
    if (FilterExpression) param.FilterExpression = FilterExpression;
    if (ScanIndexForward === false) param.ScanIndexForward = false;
    if (ProjectionExpression) param.ProjectionExpression = ProjectionExpression;
    // ページネーションを考慮して全件取得
    do {
        const res = await docClient.send(new QueryCommand(param));
        result.push(...res.Items ?? []);
        param.ExclusiveStartKey = res.LastEvaluatedKey;
        if (Limit && result?.length >= Limit) break;
    } while (param.ExclusiveStartKey);
    const outParam = Limit ? result.slice(0, Limit) : result;
    console.info("queryToDynamo result", outParam);
    return outParam;
}

export async function scanToDynamo(
    TableName: string,
    FilterExpression?: string,
    ExpressionAttributeNames?: Record<string, string>,
    ExpressionAttributeValues?: Record<string, NativeAttributeValue>
) {
    const result = [];
    const param: ScanCommandInput = { TableName };
    if (FilterExpression) param.FilterExpression = FilterExpression;
    if (ExpressionAttributeNames) param.ExpressionAttributeNames = ExpressionAttributeNames;
    if (ExpressionAttributeValues) param.ExpressionAttributeValues = ExpressionAttributeValues;
    // ページネーションを考慮して全件取得
    do {
        const res = await docClient.send(new ScanCommand(param));
        result.push(...res.Items ?? []);
        param.ExclusiveStartKey = res.LastEvaluatedKey;
    } while (param.ExclusiveStartKey);
    return result;
}

export async function batchWriteWithRetry(
    allItems: BatchItems,
    tableName: string,
    maxRetries = 3
) {
    console.info("batchWriteWithRetry", allItems, tableName, maxRetries);
    let failedCount = 0;
    for (let i = 0; i < allItems.length; i += 25) {
        let items = allItems.slice(i, i + 25);
        for (let attempt = 0; attempt < maxRetries && items.length > 0; attempt++) {
            const param: BatchWriteCommandInput = {
                RequestItems: { [tableName]: items }
            };
            console.info("BatchWrite param", param);
            const res = await docClient.send(new BatchWriteCommand(param));
            const unprocessed = res.UnprocessedItems?.[tableName];
            if (!unprocessed || unprocessed.length === 0) {
                items = [];
                break;
            }
            items = unprocessed;
            if (attempt < maxRetries - 1) {
                await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
            }
        }
        if (items.length > 0) {
            console.error(`Failed to write ${items.length} items after retries`);
            failedCount += items.length;
        }
    }
    return { failedCount, total: allItems.length };
}
