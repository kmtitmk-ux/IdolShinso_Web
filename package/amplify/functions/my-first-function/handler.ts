import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    BatchWriteCommand,
    DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";

import type { Handler } from 'aws-lambda';
import axios from 'axios';
import * as cheerio from 'cheerio';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: Handler = async (event: any) => {
    const url = 'https://c-ute.doorblog.jp/';
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const titles = $('div[title="個別記事ページへ"]') ?? [];
    const putRequests = [];
    const params = {
        RequestItems: {
            "TBL01": [
                {
                    PutRequest: {
                        Item: {
                            pk: "2025-08",
                            sk: "2025-08-01",
                            title: "First item"
                        }
                    }
                },
                {
                    DeleteRequest: {
                        Key: {
                            pk: "2025-08",
                            sk: "2025-08-02"
                        }
                    }
                }
            ]
        }
    };

    for (const el of titles) {
        const link = $(el).attr('href') as string;
        await scrapingContent(link);
        putRequests.push({
            PutRequest: { Item: {}, },
        });
    }
    // const command = new BatchWriteCommand({
    //     RequestItems: {
    //         // An existing table is required. A composite key of 'title' and 'year' is recommended
    //         // to account for duplicate titles.
    //         BatchWriteMoviesTable: putRequests,
    //     },
    // });

    // await docClient.send(command);
    return {
        statusCode: 200,
        body: ""
    };
    // JSON.stringify()
};

async function scrapingContent(link: string) {
    const res = await axios.get(link);
    const $ = cheerio.load(res.data);
    // const content = $('.article-body.entry-content')[0];
    const ths = $('.t_h');
    const tds = $('.t_b');
    for (const v of tds) {
        console.log($(v).html());
    }
    const results: string[] = [];
    return results;
}