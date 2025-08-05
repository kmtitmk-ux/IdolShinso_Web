import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    BatchWriteCommand,
    PutCommand,
    QueryCommand,
    TransactWriteCommand,
    TransactWriteCommandInput,
    DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type { Handler } from 'aws-lambda';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import { Schema } from '../../data/resource';
import dayjs from "dayjs";

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type IS01Input = Pick<Schema['IS01']['type'], 'id' | 'title' | 'head' | 'createdAt' | 'updatedAt'> & { __typename: 'IS01'; };
type IS02Input = Pick<Schema['IS02']['type'], 'id' | 'postId' | 'content' | 'createdAt' | 'updatedAt'> & { __typename: 'IS02'; };
type IS03Input = Pick<Schema['IS03']['type'], 'id' | 'postId' | 'category'> & { __typename: 'IS03'; };

export const handler: Handler = async (event: any) => {
    const pstId = uuidv4();
    const commentId = uuidv4();
    const url = 'https://c-ute.doorblog.jp/';
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const titles = $('a[title="個別記事ページへ"]');
    const hrefs: string[] = [];
    titles.each((i, el) => {
        if (i < 1) {
            const href = $(el).attr('href') as string;
            if (href) hrefs.push(href);
            const text = $(el).text();
        }
    });
    await Promise.all(hrefs.map(href => scrapingContent(href)));
    return {
        statusCode: 200,
        body: ""
    };
};

async function scrapingContent(link: string) {
    const res = await axios.get(link);
    const $ = cheerio.load(res.data);
    const tableName01 = process.env.TABLE_NAME_IS01 as string;
    const tableName02 = process.env.TABLE_NAME_IS02 as string;
    const tableName03 = process.env.TABLE_NAME_IS03 as string;
    const postId = uuidv4();
    const title = $('a[title="個別記事ページへ"]').text()?.trim() as string;

    // タイトルの重複チェック、ページ作成
    const result = await docClient.send(new QueryCommand({
        TableName: tableName01,
        IndexName: "iS01sByTitle",
        KeyConditionExpression: "#pk = :titleValue",
        ExpressionAttributeNames: { "#pk": "title" },
        ExpressionAttributeValues: { ":titleValue": title }
    }));
    console.log("result", JSON.stringify(result));

    const transactWriteParams: TransactWriteCommandInput = { TransactItems: [] };
    (transactWriteParams.TransactItems ?? []).push({
        Put: {
            TableName: tableName01,
            Item: {
                id: postId,
                title: title,
                createdAt: dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                updatedAt: dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                __typename: "IS01"
            } as IS01Input
        },
    });

    // カテゴリーの取得
    const cats = $('a[title="カテゴリアーカイブへ"]');
    const promises = cats.map(async (i, el) => {
        const category = $(el).text()?.trim() as string;
        if (category && !category.includes("カテゴリの全記事一覧")) {
            const result = await docClient.send(new QueryCommand({
                TableName: tableName03,
                IndexName: "iS03sByCategory",
                KeyConditionExpression: "#pk = :categoryValue",
                ExpressionAttributeNames: { "#pk": "category" },
                ExpressionAttributeValues: { ":categoryValue": category }
            }));
            console.log("result", JSON.stringify(result));
            (transactWriteParams.TransactItems ?? []).push({
                Put: {
                    TableName: tableName03,
                    Item: {
                        id: uuidv4(),
                        postId,
                        category,
                        __typename: "IS03"
                    } as IS03Input,
                },
            });
        }
    });
    await Promise.all(promises);
    console.info("TransactWrite params", JSON.stringify(transactWriteParams));
    await docClient.send(new TransactWriteCommand(transactWriteParams));

    // コメントの取得
    const ths = $('.t_h');
    const tds = $('.t_b');
    const is02Items: IS02Input[] = [];
    tds.each((i, el) => {
        const date = $(ths[i]).html()?.trim().replace(/.*gray;"> | 0<\/span>|\(.*?\)/g, "");
        const head = $(ths[i]).text()?.trim();
        const content = $(el).html()?.trim();
        if (content) {
            is02Items.push({
                id: uuidv4(),
                content,
                postId: postId,
                head,
                createdAt: dayjs(date).isValid() ? dayjs(date).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]') : dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                updatedAt: dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                __typename: "IS02"
            } as IS02Input);
        }
    });

    const MAX_BATCH_SIZE = 25;
    const batches = [];
    for (let i = 0; i < is02Items.length; i += MAX_BATCH_SIZE) {
        batches.push(is02Items.slice(i, i + MAX_BATCH_SIZE));
    }
    const putRequestsArray = batches.map(batch => ({
        RequestItems: {
            [tableName02]: batch.map(item => ({
                PutRequest: { Item: item as IS02Input },
            })),
        },
    }));
    const results: string[] = [];
    for (const params of putRequestsArray) {
        console.log("BatchWrite params", JSON.stringify(params));
        await docClient.send(new BatchWriteCommand(params));
    }
    return results;
};