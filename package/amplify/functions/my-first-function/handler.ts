import axios from 'axios';
import * as cheerio from 'cheerio';

export const handler = async (event: any) => {
    const url = 'https://c-ute.doorblog.jp/';
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const title = $('title').text();

    return {
        statusCode: 200,
        body: JSON.stringify({ title }),
    };

};