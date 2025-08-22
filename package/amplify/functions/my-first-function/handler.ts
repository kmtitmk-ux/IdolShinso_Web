import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    BatchWriteCommand,
    PutCommand,
    QueryCommand,
    TransactWriteCommand,
    TransactWriteCommandInput,
    DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, NoSuchKey, S3ServiceException } from "@aws-sdk/client-s3";
import {
    BedrockRuntimeClient,
    InvokeModelCommand,
    InvokeModelCommandInput,
} from "@aws-sdk/client-bedrock-runtime";

import type { Handler } from 'aws-lambda';

import axios from 'axios';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import { Schema } from '../../data/resource';
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const bedrock = new BedrockRuntimeClient();
const BUCKET_NAME_IS01 = process.env.BUCKET_NAME_IS01 as string;
const TABLE_NAME_IS01 = process.env.TABLE_NAME_IS01 as string;
const TABLE_NAME_IS02 = process.env.TABLE_NAME_IS02 as string;
const TABLE_NAME_IS03 = process.env.TABLE_NAME_IS03 as string;
const MODEL_ID = process.env.MODEL_ID as string;
const MAX_BATCH_SIZE = 25;

type IS01Input = Pick<Schema['IS01']['type'], 'id' | 'title' | 'header' | 'slug' | 'createdAt' | 'updatedAt'> & { __typename: 'IS01'; };
type IS02Input = Pick<Schema['IS02']['type'], 'id' | 'postId' | 'content' | 'createdAt' | 'updatedAt'> & { __typename: 'IS02'; };
type IS03Input = Pick<Schema['IS03']['type'], 'id' | 'postId' | 'name'> & { __typename: 'IS03'; };

export const handler: Handler = async (event: any) => {
    console.info(`EVENT: ${JSON.stringify(event)}`);
    switch (event.procType) {
        case "scrapingContent":
            const url = 'https://hpupdate.info/';
            console.info("axios", url);
            const res = await axios.get(url, {
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
            });
            await new Promise(res => setTimeout(res, 1000));
            const $ = cheerio.load(res.data);
            const titles = $('a.entry-link');
            const hrefs: string[] = [];
            titles.each((i, el) => {
                if (i < 2) {
                    const href = $(el).attr('href') as string;
                    if (href) hrefs.push(href);
                    const text = $(el).text();
                }
            });
            const outputTitles = await Promise.all(hrefs.map(href => scrapingContent(href)));
            if (outputTitles) {
                await outPutS3(outputTitles, "title");
            }
            break;
        case "updateRewriteTitle":
            const titleData = await getObjetS3("private/edit/title.jsonl") as string;
            if (titleData) await updateRewriteTitle(titleData);

            break;
    }
    return {
        statusCode: 200,
        body: ""
    };
};

async function scrapingContent(link: string) {
    const outputTitle = {
        id: "",
        title: "",
        rewrittenTitle: ""
    };
    console.info("axios", link);
    const res = await axios.get(link, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    await new Promise(res => setTimeout(res, 1000));
    const $ = cheerio.load(res.data);
    const postId = uuidv4();
    const title = $('h1.entry-title').first().text()?.trim() as string;
    console.info(title, "title");

    // タイトルの重複チェック、ページ作成
    const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME_IS01,
        IndexName: "iS01sByTitle",
        KeyConditionExpression: "#pk = :titleValue",
        ExpressionAttributeNames: { "#pk": "title" },
        ExpressionAttributeValues: { ":titleValue": title }
    }));

    // タイトルが既に存在する場合はスキップ
    if (result.Count ?? 0 > 0) {
        console.info(`Title "${title}" already exists in table ${TABLE_NAME_IS01}. Skipping.`);
        return;
    }

    const transactWriteParams: TransactWriteCommandInput = { TransactItems: [] };
    (transactWriteParams.TransactItems ?? []).push({
        Put: {
            TableName: TABLE_NAME_IS01,
            Item: {
                id: postId,
                slug: await createSlug(title),
                title: title,
                rewrittenTitle: "",
                createdAt: dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                updatedAt: dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                __typename: "IS01"
            } as IS01Input
        },
    });
    outputTitle.id = postId;
    outputTitle.title = title;

    // カテゴリーの取得
    const cats = $('.meta-box .category');
    const promises = cats.map(async (i, el) => {
        const name = $(el).text()?.trim() as string;
        if (name && !name.includes("カテゴリの全記事一覧")) {
            const result = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME_IS03,
                IndexName: "iS03sByName",
                KeyConditionExpression: "#pk = :nameValue",
                ExpressionAttributeNames: { "#pk": "name" },
                ExpressionAttributeValues: { ":nameValue": name }
            }));
            // カテゴリーが既に存在する場合はスキップ
            if (result.Count ?? 0 > 0) {
                console.info(`Category "${name}" already exists in table ${TABLE_NAME_IS03}. Skipping.`);
                return;
            }
            (transactWriteParams.TransactItems ?? []).push({
                Put: {
                    TableName: TABLE_NAME_IS03,
                    Item: {
                        id: uuidv4(),
                        postId,
                        name,
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
    const ths = $('#mainEntity .entry-title + div div.meta');
    const tds = $('#mainEntity .entry-title + div .message');
    const is02Items: IS02Input[] = [];
    let ogImageRes = { Key: "", id: "" };
    for (const [i, el] of Array.from(tds).entries()) {
        const dateText = $(ths[i]).children(".date").text()?.trim()
            .replace(/\([^)]+\)/, "")
            .replace(/\.\d+$/, "");
        const parsed = dayjs(dateText, "YYYY/MM/DD HH:mm:ss", true);
        const createdAt = parsed.isValid()
            ? parsed.format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
            : dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
        if (i === 0) {
            // アイキャッチ、OGP画像取得
            const ogImage = $('meta[property="og:image"]').attr("content") as string;
            ogImageRes = await getImage(ogImage, createdAt);
        }
        $(ths[i]).find('span.postusername').remove();
        const header = $(ths[i]).text()?.trim();
        let content = $(el).html()?.trim();
        if (content?.includes("<img")) {
            // 画像が含まれている場合は、画像をS3に保存
            const imgSrc = $(el).find('img').attr('src') as string;
            if (imgSrc) {
                const imageRes = await getImage(imgSrc, createdAt);
                content = content.replace(imgSrc, `https://${BUCKET_NAME_IS01}.s3.amazonaws.com/${imageRes.Key}`);
            }
        }
        if (content) {
            is02Items.push({
                id: uuidv4(),
                content,
                postId: postId,
                header,
                thumbnail: ogImageRes.Key,
                createdAt,
                updatedAt: dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                __typename: "IS02"
            } as IS02Input);
        }
    }
    const batches = [];
    for (let i = 0; i < is02Items.length; i += MAX_BATCH_SIZE) {
        batches.push(is02Items.slice(i, i + MAX_BATCH_SIZE));
    }
    const putRequestsArray = batches.map(batch => ({
        RequestItems: {
            [TABLE_NAME_IS02]: batch.map(item => ({
                PutRequest: { Item: item as IS02Input },
            })),
        },
    }));
    const results: string[] = [];
    for (const params of putRequestsArray) {
        console.log("BatchWrite params", JSON.stringify(params));
        await docClient.send(new BatchWriteCommand(params));
    }
    return outputTitle;
};

// S3に画像を保存する関数
async function getImage(ogImage: string, date: string) {
    console.info("axios", ogImage);
    const res = await axios.get(ogImage, {
        responseType: "arraybuffer",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    await new Promise(res => setTimeout(res, 1000));
    const contentType = res.headers["content-type"];
    if (!contentType || !contentType.startsWith("image/")) {
        throw new Error(`Invalid content type: ${contentType}`);
    }
    let ext = contentType.replace("image/", ".");
    if (ext === ".jpeg") ext = ".jpg";
    // S3キー作成
    const id = uuidv4();
    const Key = `${dayjs(date).format("public/YYYY/MM/DD/")}${id}${ext}`;
    // PutObject パラメータ
    const putObjParam = {
        Bucket: BUCKET_NAME_IS01,
        Key,
        Body: Buffer.from(res.data),
    };
    console.info("PutObject REQ", putObjParam);
    const putResult = await s3.send(new PutObjectCommand(putObjParam));
    console.info("PutObject RES", putResult);
    return { Key, id };
}

// スラッグを作成する関数
async function createSlug(title: string) {
    console.info("createSlug", title);
    const prompt = `
以下の日本語タイトルをURLスラッグに変換してください。ルール：
1. 漢字をHepburn式ローマ字に変換
2. スペースをハイフン（-）に置き換え
3. 特殊文字（！、？、【】、絵文字など）を削除
4. すべて小文字

タイトル: ${title}
`;
    const input = {
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
            inputText: prompt,
            textGenerationConfig: {
                maxTokenCount: 512,
                temperature: 0.7,
                topP: 0.9
            }
        })
    };
    const response = await bedrock.send(new InvokeModelCommand(input));
    const data = JSON.parse(new TextDecoder().decode(response.body));
    console.info("bedrock", data);
    const rawText = data?.results?.[0]?.outputText || '';
    let slug = await toUrlSlug(rawText);
    console.info('slug', slug);
    // 重複チェックを追加する
    let baseSlug = slug;
    let counter = 1;
    let count = 0;
    do {
        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME_IS01,
            IndexName: "iS01sBySlug",
            KeyConditionExpression: "#pk = :slugValue",
            ExpressionAttributeNames: { "#pk": "slug" },
            ExpressionAttributeValues: { ":slugValue": slug }
        }));
        count = result.Count ?? 0;
        if (count > 0) slug = `${baseSlug}-${counter++}`;
    } while (count > 0);
    return slug;
};

// 全角を削除する関数
async function toUrlSlug(str: string) {
    if (!str) return '';
    return str
        // ASCII以外を削除（全角文字や絵文字も含む）
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-') // 空白→ハイフン
        .toLowerCase();
}

// S3に格納する関数
async function outPutS3(output: any, fileName: string) {
    let newData = "";
    // if (listData.Contents) {
    //     for (const v of listData.Contents) {
    //         newCommentData += await processS3getObjet(v) + "\n";
    //     }
    // }
    // JSON LINEとして保存する場合
    newData += output.map((item: any) => {
        return JSON.stringify(item);
    }).join('\n');
    // コメントデータをS3に格納
    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET_NAME_IS01,
            Key: `private/original/${fileName}.jsonl`,
            Body: newData,
        })
    );
}

// S3からデータを取得する
async function getObjetS3(Key: string) {
    try {
        const response = await s3.send(
            new GetObjectCommand({
                Bucket: BUCKET_NAME_IS01,
                Key,
            }),
        );
        return await response.Body?.transformToString?.();
    } catch (caught) {
        if (caught instanceof NoSuchKey) {
            console.error(
                `Error from S3 while getting object "${Key}" from "${BUCKET_NAME_IS01}". No such key exists.`,
            );
        } else if (caught instanceof S3ServiceException) {
            console.error(
                `Error from S3 while getting object from ${BUCKET_NAME_IS01}.  ${caught.name}: ${caught.message}`,
            );
        } else {
            throw caught;
        }
    }
}

async function updateRewriteTitle(titleData: string) {
    const newTitleData = titleData.split('\n')
        .filter(line => line.trim() !== '')
        .map(line => JSON.parse(line));
    for (let i = 0; i < newTitleData.length; i += MAX_BATCH_SIZE) {
        const batch = newTitleData.slice(i, i + MAX_BATCH_SIZE);
        const transactWriteParams = {
            TransactItems: batch.map(item => ({
                Update: {
                    TableName: TABLE_NAME_IS01,
                    Key: { id: item.id },
                    UpdateExpression: "SET rewrittenTitle = :rewrittenTitle",
                    ExpressionAttributeValues: { ":rewrittenTitle": item.rewrittenTitle },
                }
            }))
        };
        console.info("TransactWrite params", JSON.stringify(transactWriteParams));
        await docClient.send(new TransactWriteCommand(transactWriteParams));
    }
}