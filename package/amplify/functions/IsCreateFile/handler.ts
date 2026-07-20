import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3";
import {
  QueryCommand,
  QueryCommandInput,
  DynamoDBDocumentClient
} from "@aws-sdk/lib-dynamodb";
import dayjs from "dayjs";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
import type { Handler } from 'aws-lambda';

// 環境変数からDynamoDBテーブル名とS3バケット名を取得
const TABLE_NAME_SNS_POSTS: string = process.env.TABLE_NAME_SNS_POSTS ?? "";
const BUCKET_NAME_01: string = process.env.BUCKET_NAME_01 ?? "";

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});

export const handler: Handler = async (event) => {
  console.info(`EVENT: ${JSON.stringify(event)}`);
  try {
    switch (event.procType) {
      case "createDailyFile": {
        for (const platform of ["x", "threads"]) {
          try {
            // 直近7日間のThreads投稿をGSIで取得
            const postItems = await queryToDynamo(
              TABLE_NAME_SNS_POSTS,
              "isSnsByPlatformAndUpdatedAt",
              "#platform = :platform AND #updatedAt >= :updatedAt",
              "#lang = :lang",
              {
                "#platform": "platform",
                "#updatedAt": "updatedAt",
                "#lang": "lang"
              },
              {
                ":platform": platform,
                ":updatedAt": dayjs().subtract(14, "day").toISOString(),
                ":lang": "ja"
              },
              0
            );

            // 投稿を更新日（YYYY-MM-DD）ごとにグループ化してJSONL形式に変換
            const createFiles: Record<string, string> = {};
            for (const item of postItems) {
              const key: string = dayjs(item.updatedAt).format("YYYY-MM-DD");
              createFiles[key] = createFiles[key] || "";
              createFiles[key] += JSON.stringify(item) + "\n";
            }

            // 日付ごとにS3へ並列アップロード（パス例: SNS_POST_DATA/THREADS/ENGAGEMENT/2024/01/2024-01-01.jsonl）
            const uploadPromises = Object.entries(createFiles).map(([date, content]) => {
              const targetDate = dayjs(date);
              return s3Client.send(new PutObjectCommand({
                Bucket: BUCKET_NAME_01,
                Key: `SNS_POST_DATA/${platform.toUpperCase()}/ENGAGEMENT/${targetDate.format("YYYY/MM")}/${targetDate.format("YYYY-MM-DD")}.jsonl`,
                Body: content
              }));
            });
            await Promise.all(uploadPromises);
          } catch (error) {
            console.warn(error);
          }
        }
        break;
      }
      default: {
        throw new Error(`Unknown procType: ${event.procType}`);
      }
    }
  } catch (error) {
    console.error(error);
  }
  return { statusCode: 200, body: "" };
};

// ページネーション対応のDynamoDBクエリ（LastEvaluatedKey がなくなるまで全件取得）
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
  };
  if (Limit) param.Limit = Limit;
  do {
    const result = await docClient.send(new QueryCommand(param));
    outParam.push(...result.Items ?? []);
    param.ExclusiveStartKey = result.LastEvaluatedKey;
    if (Limit && outParam?.length >= Limit) {
      break;
    }
  } while (param.ExclusiveStartKey);
  console.info("queryToDynamo result", outParam);
  return outParam;
}