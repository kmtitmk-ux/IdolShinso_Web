import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    BatchWriteCommand,
    PutCommand,
    PutCommandInput,
    QueryCommand,
    QueryCommandInput,
    UpdateCommand,
    UpdateCommandInput,
    DynamoDBDocumentClient
} from "@aws-sdk/lib-dynamodb";
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    NoSuchKey,
    S3ServiceException
} from "@aws-sdk/client-s3";
import axios from 'axios';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import { Schema } from '../../data/resource';
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import wanakana from "wanakana";
import type { Handler } from 'aws-lambda';

dayjs.extend(customParseFormat);

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const BUCKET_NAME_IS_01 = process.env.BUCKET_NAME_IS_01 as string;
const TABLE_NAME_IS_POSTS = process.env.TABLE_NAME_IS_POSTS as string;
const TABLE_NAME_IS_POSTMETA = process.env.TABLE_NAME_IS_POSTMETA as string;
const TABLE_NAME_IS_TERMS = process.env.TABLE_NAME_IS_TERMS as string;
const TABLE_NAME_IS_COMMENTS = process.env.TABLE_NAME_IS_COMMENTS as string;
const MAX_BATCH_SIZE = 25;
const MAIN_CONTENT_PROMPT = `
以下のJSONL形式のデータには、各行に "title" キーを持つブログタイトルが含まれています。
それぞれの "title" を、SEO対策とCTA（行動喚起）を意識して魅力的にリライトしてください。
リライトしたタイトルは "rewrittenTitle" キーに格納してください。

【リライトのルール】
- 検索されやすいキーワードを含める（例：人物名、話題、地域、目的、数字など）
- 読者の行動を促す表現を加える（例：「必見」「保存版」「今すぐ」「簡単に」「チェック」など）
- ターゲット読者が明確になるようにする（例：「初心者向け」「ファン必見」など）
- 文字数は全角で28〜32文字程度を目安に、自然で読みやすい日本語にする
- 元のタイトルの話題性は維持すること
🔧 出力形式：
- 入力と同じJSONL形式で出力すること
- 各行に "title" と "rewrittenTitle" を含めること
- "rewrittenTitle" にはリライト済みのタイトルを格納すること`;
// type IS_POSTS_INPUT = Pick<Schema['IsPosts']['type'], 'id' | 'title' | 'slug' | 'createdAt' | 'rewrittenTitle' | 'thumbnail' | 'updatedAt'> & { __typename: 'IsPosts'; };
// type IS_POSTMETA_INPUT = Pick<Schema['IsPostMeta']['type'], 'id' | 'postId' | 'name' | 'slug' | 'createdAt' | 'updatedAt'> & { __typename: 'IsPostMeta'; };
// type IS_TERMS_INPUT = Pick<Schema['IsTerms']['type'], 'id' | 'name' | 'slug' | 'taxonomy' | 'createdAt' | 'updatedAt'> & { __typename: 'IsTerms'; };
type IS_COMMENTS_INPUT = Pick<Schema['IsComments']['type'], 'id' | 'postId' | 'createdAt' | 'updatedAt'> & { __typename: 'IsComments'; };
type OutputResult = {
    id: string;
    title: string;
    rewrittenTitle: string;
};
export const handler: Handler = async (event: any) => {
    console.info(`EVENT: ${JSON.stringify(event)}`);
    switch (event.procType) {
        case "scrapingContent":
            const outputResults: OutputResult[] = [];
            const url = 'https://hpupdate.info/';
            console.info("axios", url);
            const res = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
            await new Promise(res => setTimeout(res, 1000));
            const $ = cheerio.load(res.data);
            const titles = $('a.entry-link').slice(0, 10);
            for (const el of titles.toArray()) {
                const href = $(el).attr('href');
                const title = $(el).text().trim();
                if (!href) continue;
                await scrapingContent(href, title, outputResults);
            }
            await outPutS3(outputResults, "title");
            break;
        case "updateRewriteTitle":
            const titleData = await getObjetS3(`private/edit/title-${dayjs().format("YYYYMMDD")}.jsonl`) as string;
            if (titleData) await updateRewriteTitle(titleData);
            break;
    }
    return {
        statusCode: 200,
        body: ""
    };
};


async function scrapingContent(link: string, title: string, outputResults: OutputResult[]) {
    const psotItem = await queryToDynamo(TABLE_NAME_IS_POSTS, "isPostsByTitle", "title = :title", { ":title": title });
    if (psotItem.length) return;

    console.info("axios", link);
    const res = await axios.get(link, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
    await new Promise(res => setTimeout(res, 1000));
    const postId = uuidv4();
    const createdAt = dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
    const $ = cheerio.load(res.data);

    // アイキャッチ、OGP画像取得
    const ogImage = $('meta[property="og:image"]').attr("content") as string;
    const ogImageRes = await getImage(ogImage, createdAt);
    console.info("ogImageRes", ogImageRes);

    // スラッグ作成
    let slug = await createSlug(title);
    slug = await checkSlugWithRetry(slug, TABLE_NAME_IS_POSTS, "isPostsBySlug", "slug = :slug");

    // 投稿の登録（タイトルの重複チェック） 
    if (!psotItem.length) {
        const param: PutCommandInput = {
            TableName: TABLE_NAME_IS_POSTS,
            Item: {
                id: postId,
                slug,
                title,
                status: "draft",
                thumbnail: ogImageRes.Key,
                rewrittenTitle: "",
                createdAt,
                updatedAt: createdAt,
                __typename: "IsPosts"
            }
        };
        console.info("PutCommand param", param);
        await docClient.send(new PutCommand(param));
    }

    // タームの取得
    const terms = $('.meta-box span[itemprop="keywords"]');
    const promises = terms.map(async (i, el) => {
        const taxonomy = $(el).attr("class")?.trim() as string;
        const names = $(el).find("a");
        for (const nameEl of names) {
            const name = $(nameEl).text()?.trim() as string;
            if (name && taxonomy) {
                // 投稿メタの登録
                const slug = await createSlug(name);
                const slugTaxonomy = `${slug}_${taxonomy}`;
                const param: PutCommandInput = {
                    TableName: TABLE_NAME_IS_POSTMETA,
                    Item: {
                        id: uuidv4(),
                        postId,
                        name,
                        slug,
                        taxonomy,
                        slugTaxonomy,
                        createdAt: dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                        updatedAt: dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                        __typename: "IsPostMeta"
                    }
                };
                console.info("PutCommand parma", param);
                await docClient.send(new PutCommand(param));

                // タームの登録（存在しない場合のみ）
                const termItem = await queryToDynamo(TABLE_NAME_IS_TERMS, "isTermsBySlug", "slug = :slug", { ":slug": slug });
                if (!termItem.length) {
                    const param: PutCommandInput = {
                        TableName: TABLE_NAME_IS_TERMS,
                        Item: {
                            id: uuidv4(),
                            name,
                            slug,
                            taxonomy,
                            createdAt: dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                            updatedAt: dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                            __typename: "IsTerms"
                        }
                    };
                    console.info("PutCommand parma", param);
                    await docClient.send(new PutCommand(param));
                }
            }
        }
    });
    await Promise.all(promises);

    // コメントの取得
    const ths = $('#mainEntity .entry-title + div div.meta');
    const tds = $('#mainEntity .entry-title + div .message');
    const pushItems: IS_COMMENTS_INPUT[] = [];
    for (const [i, el] of Array.from(tds).entries()) {
        let ogImageRes = { Key: "", id: "" };
        const commentDateText = $(ths[i]).text()?.trim().match(/\d{4}\/\d{2}\/\d{2}(?:\(.{1}\))? \d{2}:\d{2}:\d{2}\.\d{2}/) ?? [];
        const commentDate = dayjs(commentDateText[0] ?? "".replace(/\(.{1}\)/, ""), "YYYY/MM/DD HH:mm:ss");
        const createdAt = commentDate.isValid()
            ? commentDate.format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
            : dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
        if (i === 0) {
            // アイキャッチ、OGP画像取得
            const ogImage = $('meta[property="og:image"]').attr("content") as string;
            ogImageRes = await getImage(ogImage, createdAt);
            console.info("ogImageRes", ogImageRes);
        }
        $(ths[i]).find('span.postusername').text(" : ");
        let header = $(ths[i]).text()?.trim().replace(" ：名無し募集中。。。：", " : ").replace(".net", "");
        if (!header || header === ":") {
            header = `${Array.from(tds).length - i} : ${dayjs().format("YYYY/MM/DD(dd) HH:mm:ss.SS")}`;
        }
        let content = $(el).html()?.trim();
        if (content?.includes("<img")) {
            // 画像が含まれている場合は、画像をS3に保存
            const imgSrc = $(el).find('img').attr('src') as string;
            if (imgSrc) {
                const imageRes = await getImage(imgSrc, createdAt);
                content = content.replace(imgSrc, `https://${BUCKET_NAME_IS_01}.s3.amazonaws.com/${imageRes.Key}`);
            }
        }
        if (!content?.includes("スポンサーリンク")) {
            pushItems.push({
                id: uuidv4(),
                postId,
                content,
                header,
                createdAt,
                updatedAt: dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                __typename: "IsComments"
            } as IS_COMMENTS_INPUT);
        }
    }

    // コメントの一括登録
    await batchWriteItems(pushItems);

    // 返却
    outputResults.push({
        id: postId,
        title: title,
        rewrittenTitle: ""
    });
};

// コメントをバッチ登録する関数
async function batchWriteItems(items: IS_COMMENTS_INPUT[]) {
    console.info("batchWriteItems IN:", items.length);
    // バッチ分割
    const batches = [];
    for (let i = 0; i < items.length; i += MAX_BATCH_SIZE) {
        batches.push(items.slice(i, i + MAX_BATCH_SIZE));
    }
    const putRequestsArray = batches.map(batch => ({
        RequestItems: {
            [TABLE_NAME_IS_COMMENTS]: batch.map(item => ({
                PutRequest: { Item: item as IS_COMMENTS_INPUT },
            })),
        },
    }));
    // バッチごとに処理
    for (const params of putRequestsArray) {
        console.info("BatchWriteCommand params", JSON.stringify(params));
        const result = await docClient.send(new BatchWriteCommand(params));
        console.info("BatchWriteCommand result", JSON.stringify(result));
        // 未処理アイテムがあればリトライ
        if (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0) {
            let unprocessed = result.UnprocessedItems;
            while (Object.keys(unprocessed).length > 0) {
                await new Promise(res => setTimeout(res, 1000));
                const retryParams = { RequestItems: unprocessed };
                const retryResult = await docClient.send(new BatchWriteCommand(retryParams));
                unprocessed = retryResult.UnprocessedItems || {};
            }
        }
    }
}


async function queryToDynamo(
    TableName: string,
    IndexName: string,
    KeyConditionExpression: string,
    ExpressionAttributeValues: Record<string, any>
) {
    const outParam = [];
    const param: QueryCommandInput = {
        TableName,
        IndexName,
        KeyConditionExpression,
        ExpressionAttributeValues,
        Limit: 1
    };
    do {
        console.info("QueryCommand param", param);
        const result = await docClient.send(new QueryCommand(param));
        console.info("QueryCommand result", result);
        outParam.push(...result.Items ?? []);
        param.ExclusiveStartKey = result.LastEvaluatedKey;
    } while (param.ExclusiveStartKey);
    return outParam;
}

// スラッグの重複チェックと更新
async function checkSlugWithRetry(
    slug: string,
    tableName: string,
    indexName: string,
    keyConditionExpression: string,
) {
    const baseSlug = slug;
    let counter = 0;
    while (true) {
        const result = await queryToDynamo(tableName, indexName, keyConditionExpression, { ":slug": slug });
        if (result.length === 0) break;
        counter++;
        slug = `${baseSlug}-${counter}`;
    }
    return slug;
}

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
        Bucket: BUCKET_NAME_IS_01,
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
    console.info("createSlug IN:", title);
    // 日本語をローマ字に変換
    let slug = wanakana.toRomaji(title);
    // 小文字化
    slug = slug.toLowerCase();
    // 英数字以外をハイフンに置換
    slug = slug.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    console.info("createSlug OUT:", JSON.stringify(slug));
    if (!slug) slug = title;
    return slug;
};


// S3に格納する関数
async function outPutS3(output: any, fileName: string) {
    console.info("outPutS3 IN:", output, fileName);
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
    const params = {
        Bucket: BUCKET_NAME_IS_01,
        Key: `private/edit/${fileName}_prompt.txt`,
        Body: newData,
    };
    console.info("PutObject REQ", params);
    await s3.send(new PutObjectCommand(params));
}


// S3からデータを取得する
async function getObjetS3(Key: string) {
    try {
        const response = await s3.send(
            new GetObjectCommand({
                Bucket: BUCKET_NAME_IS_01,
                Key,
            }),
        );
        return await response.Body?.transformToString?.();
    } catch (caught) {
        if (caught instanceof NoSuchKey) {
            console.error(
                `Error from S3 while getting object "${Key}" from "${BUCKET_NAME_IS_01}". No such key exists.`,
            );
        } else if (caught instanceof S3ServiceException) {
            console.error(
                `Error from S3 while getting object from ${BUCKET_NAME_IS_01}.  ${caught.name}: ${caught.message}`,
            );
        } else {
            throw caught;
        }
    }
}


// タイトルの更新関数
async function updateRewriteTitle(titleData: string) {
    const newTitleData = titleData.split('\n')
        .filter(line => line.trim() !== '')
        .map(line => JSON.parse(line));
    for (const v of newTitleData) {
        const param: UpdateCommandInput = {
            TableName: TABLE_NAME_IS_POSTS,
            Key: { id: v.id },
            UpdateExpression: "SET #rewrittenTitle = :rewrittenTitle, #status = :status",
            ExpressionAttributeNames: {
                "#rewrittenTitle": "rewrittenTitle",
                "#status": "status"
            },
            ExpressionAttributeValues: {
                ":rewrittenTitle": v.rewrittenTitle,
                ":status": "published"
            },
            ConditionExpression: "attribute_exists(id)",
            ReturnValues: "UPDATED_NEW"
        };
        console.info("Update param", JSON.stringify(param));
        await docClient.send(new UpdateCommand(param));
    }
}