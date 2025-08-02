import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    BatchWriteCommand,
    PutCommand,
    DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { marshall } from '@aws-sdk/util-dynamodb';
import type { Handler } from 'aws-lambda';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import { Schema } from '../../data/resource';
import dayjs from "dayjs";

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
type IS01Input = Pick<Schema['IS01']['type'], 'id' | 'title'>;
type IS02Input = Pick<Schema['IS02']['type'], 'id' | 'postId' | 'content' | 'createdAt' | 'updatedAt'>;
type IS03Input = Pick<Schema['IS03']['type'], 'id'>;
interface ScrapingInput {
    link: string;
    postId?: string;
}
export const handler: Handler = async (event: any) => {
    console.log("event", event);
    const pstId = uuidv4();
    console.log("pstId", pstId);
    const commentId = uuidv4();
    console.log("commentId", commentId);
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
            console.log(`リンク${i}: ${text} (${href})`);
        }
    });
    await Promise.all(hrefs.map(href => scrapingContent(href)));

    return {
        statusCode: 200,
        body: ""
    };
    // JSON.stringify()
};

async function scrapingContent(link: string) {
    const res = await axios.get(link);
    const $ = cheerio.load(res.data);
    const tableName01: string = "IS01";
    const tableName02: string = "IS02";
    const tableName03: string = "IS03";
    const is02Items: IS02Input[] = [];
    const postId = uuidv4();
    const title = $('a[title="個別記事ページへ"]').text();
    // IS01 の作成（DynamoDB SDK）
    await docClient.send(new PutCommand({
        TableName: tableName01,
        Item: {
            id: postId,
            title: title
        },
    }));
    const cats = $('a[title="カテゴリアーカイブへ"]');
    cats.each((i, el) => {
        const text = $(el).text();
        console.log(`リンク${i}: ${text}`);
    });

    const ths = $('.t_h');
    const tds = $('.t_b');
    tds.each((i, el) => {
        const th = $(ths[i]).html()?.trim().replace(/.*gray;"> | 0<\/span>|\(.*?\)/g, "");
        console.log("th", th);
        const content = $(el).html()?.trim();
        if (content) {
            is02Items.push({
                id: uuidv4(),
                content,
                postId: postId,
                createdAt: dayjs(th).isValid() ? dayjs(th).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]') : dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                updatedAt: dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
            });
        }
    });

    const MAX_BATCH_SIZE = 25;
    const batches: IS02Input[][] = [];
    for (let i = 0; i < is02Items.length; i += MAX_BATCH_SIZE) {
        batches.push(is02Items.slice(i, i + MAX_BATCH_SIZE));
    }
    const putRequestsArray = batches.map(batch => ({
        RequestItems: {
            [tableName02]: batch.map(item => ({
                PutRequest: {
                    Item: marshall(item),
                },
            })),
        },
    }));
    console.log("putRequestsArray", JSON.stringify(putRequestsArray));


    const results: string[] = [];
    // const command = new BatchWriteCommand({
    //     RequestItems: {
    //         // An existing table is required. A composite key of 'title' and 'year' is recommended
    //         // to account for duplicate titles.
    //         BatchWriteMoviesTable: putRequests,
    //     },
    // });
    // await docClient.send(command);
    return results;
}