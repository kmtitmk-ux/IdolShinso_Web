import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    QueryCommand,
    QueryCommandInput,
    DynamoDBDocumentClient
} from "@aws-sdk/lib-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function queryToDynamo(
    TableName: string,
    IndexName: string | undefined,
    KeyConditionExpression: string,
    FilterExpression: string | undefined,
    ExpressionAttributeNames: Record<string, string>,
    ExpressionAttributeValues: Record<string, NativeAttributeValue>,
    Limit: number
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