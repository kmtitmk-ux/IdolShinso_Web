import { PutObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  UpdateCommand,
  DynamoDBDocumentClient
} from "@aws-sdk/lib-dynamodb";
import dayjs from "dayjs";
import * as dynamodbHelpers from '../shared/dynamodb-helpers.js';
import type { Handler } from 'aws-lambda';
import type { Schema } from '../../data/resource';

// 環境変数からDynamoDBテーブル名とS3バケット名を取得
const TABLE_NAME_SNS_POSTS: string = process.env.TABLE_NAME_SNS_POSTS ?? "";
const BUCKET_NAME_01: string = process.env.BUCKET_NAME_01 ?? "";
const s3Client = new S3Client({});
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
type IsSnsItem = Schema["IsSns"]["type"];

// クエリ結果に型
export const handler: Handler = async (event) => {
  console.info(`EVENT: ${JSON.stringify(event)}`);
  try {
    switch (event.procType) {
      case "createDailyFile": {
        for (const platform of ["x", "threads"]) {
          try {
            // 直近7日間のThreads投稿をGSIで取得
            const postItems = await dynamodbHelpers.queryToDynamo(
              TABLE_NAME_SNS_POSTS,
              "isSnsByPlatformAndCreatedAt",
              "#platform = :platform AND #createdAt >= :createdAt",
              "#lang = :lang",
              {
                "#platform": "platform",
                "#createdAt": "createdAt",
                "#lang": "lang"
              },
              {
                ":platform": platform,
                ":createdAt": dayjs().subtract(14, "day").toISOString(),
                ":lang": "ja"
              },
              0
            ) as IsSnsItem[];

            // 各アイテムのs3Keyを確定（既存があればそれを使用、無ければ日付から生成）
            const itemsWithKey = postItems.map((item) => {
              const targetDate = dayjs(item.createdAt);
              const s3Key: string =
                item.s3Key ??
                `KB/SNS_POST_DATA/${platform.toUpperCase()}/ENGAGEMENT/${targetDate.format("YYYY/MM")}/${targetDate.format("YYYY-MM-DD")}.jsonl`;
              return { ...item, s3Key };
            });

            // s3Keyが無かったアイテムだけDBのs3Key属性を更新
            const dbUpdatePromises = itemsWithKey
              .filter((item: IsSnsItem, i: number) => !postItems[i].s3Key)
              .map((item) => {
                docClient.send(new UpdateCommand({
                  TableName: TABLE_NAME_SNS_POSTS,
                  Key: { id: item.id },
                  UpdateExpression: "SET #s3Key = :s3Key",
                  ExpressionAttributeNames: { "#s3Key": "s3Key" },
                  ExpressionAttributeValues: { ":s3Key": item.s3Key }
                }));
              });
            await Promise.all(dbUpdatePromises);

            // 投稿を更新日（YYYY-MM-DD）ごとにグループ化してJSONL形式に変換
            const createFiles: Record<string, string> = {};
            for (const item of postItems) {
              const key: string = dayjs(item.createdAt).format("YYYY-MM-DD");
              createFiles[key] = createFiles[key] || "";
              createFiles[key] += JSON.stringify(item) + "\n";
            }

            // 日付ごとにS3へ並列アップロード
            const uploadPromises = Object.entries(createFiles).map(([date, content]) => {
              const targetDate = dayjs(date);
              const Key = `KB/SNS_POST_DATA/${platform.toUpperCase()}/ENGAGEMENT/${targetDate.format("YYYY/MM")}/${targetDate.format("YYYY-MM-DD")}.jsonl`;
              return s3Client.send(new PutObjectCommand({
                Bucket: BUCKET_NAME_01,
                Key,
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