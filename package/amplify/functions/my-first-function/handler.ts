import type { Handler } from 'aws-lambda';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const handler: Handler = async (event: any) => {
    const url = 'https://c-ute.doorblog.jp/';
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const titles = $('div[title="個別記事ページへ"]') ?? [];
    for (const el of titles) {
        const link = $(el).attr('href') as string;
        await scrapingContent(link);
    }
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