import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    BatchWriteCommand,
    PutCommand,
    PutCommandInput,
    UpdateCommand,
    UpdateCommandInput,
    DynamoDBDocumentClient
} from "@aws-sdk/lib-dynamodb";
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    DeleteObjectCommand,
    NoSuchKey,
    S3ServiceException
} from "@aws-sdk/client-s3";
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import { Schema } from '../../data/resource';
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import wanakana from "wanakana";
import yaml from 'js-yaml';
import { create } from 'xmlbuilder2';
import * as dynamodbHelpers from '../shared/dynamodb-helpers';
import type { Handler } from 'aws-lambda';

dayjs.extend(customParseFormat);

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});
const translateClient = new TranslateClient({});

const NEXT_PUBLIC_CLOUDFRONT_DOMAIN = process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN as string;
const BUCKET_NAME_IS_01 = process.env.BUCKET_NAME_IS_01 as string;
const TABLE_NAME_IS_POSTS = process.env.TABLE_NAME_IS_POSTS as string;
const TABLE_NAME_IS_POSTMETA = process.env.TABLE_NAME_IS_POSTMETA as string;
const TABLE_NAME_IS_TERMS = process.env.TABLE_NAME_IS_TERMS as string;
const TABLE_NAME_IS_COMMENTS = process.env.TABLE_NAME_IS_COMMENTS as string;
const TABLE_NAME_IS_POSTS_TRANSLATIONS = process.env.TABLE_NAME_IS_POSTS_TRANSLATIONS as string;
const TABLE_NAME_IS_SNS = process.env.TABLE_NAME_IS_SNS as string;
const MAX_BATCH_SIZE = 25;

type IS_COMMENTS_INPUT = Pick<Schema['IsComments']['type'], 'id' | 'postId' | 'createdAt' | 'updatedAt'> & { __typename: 'IsComments'; };
type IS_COMMENTS_TRANSLATIONS_INPUT = Pick<Schema['IsCommentsTranslations']['type'], 'id' | 'postId' | 'createdAt' | 'updatedAt'> & { __typename: 'IsCommentsTranslations'; };
type OutputResult = {
    id: string;
    title: string;
    rewrittenTitle: string;
};
type MainContPromptParts = {
    id: string;
    title: string;
    category: string;
    tags: string[];
    comments: string[];
};
export const handler: Handler = async (event: any) => {
    console.info(`EVENT: ${JSON.stringify(event)}`);
    switch (event.procType) {
        case "scrapingContent": {
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
            if (outputResults.length) {
                // プロンプト作成
                const TITLE_PROMPT = await getObjetS3(`private/prompt/TITLE_PROMPT.txt`) as string;
                let inputData = TITLE_PROMPT + "\n";
                inputData += outputResults.map((item: any) => {
                    return JSON.stringify(item);
                }).join('\n');
                await outPutS3(inputData, "title");
            }
            break;
        }
        case "updateRewriteTitle": {
            const titleData = await getObjetS3(`private/edit/title.jsonl`) as string;
            if (titleData) await updateRewriteTitle(titleData);
            break;
        }
        case "updateMainContent": {
            const { Contents = [] } = await s3Client.send(new ListObjectsV2Command({
                Bucket: BUCKET_NAME_IS_01,
                Prefix: "private/edit/"
            }));
            for (const v of ["main", "short"]) {

                // 日本語記事
                const articlesTxt = await getObjetS3(`private/edit/${v}_articles.yml`) as string;
                const yamlResult = (yaml.load(articlesTxt) as { articles: Record<string, string>[]; }) ?? { articles: [] };
                const { articles } = yamlResult;
                console.info("yaml data", articles);

                // 英語記事
                const articlesEnTxt = await getObjetS3(`private/edit/${v}_articles_en.yml`) as string;
                const yamlResultEn = (yaml.load(articlesEnTxt) as { articles: Record<string, string>[]; }) ?? { articles: [] };
                const { articles: articlesEn } = yamlResultEn;
                console.info("yaml data", articlesEn);

                for (const article of articles) {
                    const articleEn = articlesEn.filter(item => item.id === article.id)[0];
                    try {
                        switch (v) {
                            case "main": {
                                const updateParamJa: UpdateCommandInput = {
                                    TableName: TABLE_NAME_IS_POSTS,
                                    Key: { id: article.id },
                                    UpdateExpression: "SET #content = :content",
                                    ExpressionAttributeNames: { "#content": "content" },
                                    ExpressionAttributeValues: { ":content": article.html },
                                    ReturnValues: "UPDATED_NEW",
                                    ConditionExpression: "attribute_exists(id)"
                                };
                                console.info("Update docClient param", JSON.stringify(updateParamJa));
                                await docClient.send(new UpdateCommand(updateParamJa));

                                // 英語更新
                                if (articleEn) {
                                    const Items = await dynamodbHelpers.queryToDynamo(
                                        TABLE_NAME_IS_POSTS_TRANSLATIONS,
                                        "isPostsTranslationsByPostId",
                                        "#postId = :postId",
                                        "#lang = :lang",
                                        {
                                            "#postId": "postId",
                                            "#lang": "lang"
                                        },
                                        {
                                            ":postId": article.id,
                                            ":lang": "en"
                                        },
                                        0
                                    );
                                    if (Items && Items.length > 0) {
                                        const updateParamEn: UpdateCommandInput = {
                                            TableName: TABLE_NAME_IS_POSTS_TRANSLATIONS,
                                            Key: { id: Items[0].id },
                                            UpdateExpression: "SET #content = :content",
                                            ExpressionAttributeNames: { "#content": "content" },
                                            ExpressionAttributeValues: { ":content": articleEn.html },
                                            ReturnValues: "UPDATED_NEW",
                                            ConditionExpression: "attribute_exists(id)"
                                        };
                                        console.info("UpdateCommand param", updateParamEn);
                                        await docClient.send(new UpdateCommand(updateParamEn));
                                    }
                                }
                                break;
                            }
                            case "short": {
                                const date = dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
                                const putParamJa: PutCommandInput = {
                                    TableName: TABLE_NAME_IS_SNS,
                                    Item: {
                                        id: uuidv4(),
                                        contentText: article.TEXT,
                                        createdAt: date,
                                        engagementRate: 0,
                                        lang: "ja",
                                        postId: article.id,
                                        platform: "threads",
                                        snsPostId: "",
                                        status: "scheduled",
                                        updatedAt: date,
                                        __typename: "IsSns"
                                    },
                                };
                                console.info("Put docClient param ja", putParamJa);
                                await docClient.send(new PutCommand(putParamJa));

                                // 英語更新
                                if (articleEn) {
                                    const putParamEn: PutCommandInput = {
                                        TableName: TABLE_NAME_IS_SNS,
                                        Item: {
                                            ...putParamJa.Item,
                                            id: uuidv4(),
                                            contentText: articleEn.TEXT,
                                            lang: "en",
                                            createdAt: date,
                                            updatedAt: date
                                        }
                                    };
                                    console.info("Put docClient param en", putParamEn);
                                    await docClient.send(new PutCommand(putParamEn));
                                }
                                break;
                            }
                        }
                        const Key = Contents.filter(c => c.Key?.includes(`${v}Content_${article.id}`))[0]?.Key;
                        if (Key) {
                            const deleteS3Param = { Bucket: BUCKET_NAME_IS_01, Key };
                            console.info("Delete s3Client param", deleteS3Param);
                            await s3Client.send(new DeleteObjectCommand(deleteS3Param));
                        }
                    } catch (e: any) {
                        console.error(article, e);
                        if ((e as any).errorType === "ValidationException" || (e as any).errorType === "ConditionalCheckFailedException") {
                            console.warn(`Item with id ${article.id} does not exist. Skipping update.`);
                            continue;
                        }
                        throw e;
                    }
                }

                const putS3ParamJa = {
                    Bucket: BUCKET_NAME_IS_01,
                    Key: `private/edit/${v}_articles.yml`,
                    Body: " "
                };
                console.info("Put s3Client param", putS3ParamJa);
                await s3Client.send(new PutObjectCommand(putS3ParamJa));

                const putS3ParamEn = {
                    ...putS3ParamJa,
                    Key: `private/edit/${v}_articles_en.yml`,
                };
                console.info("Put s3Client param", putS3ParamEn);
                await s3Client.send(new PutObjectCommand(putS3ParamEn));
            }
            break;
        }
        case "createSitemap": {
            const psotItem = await dynamodbHelpers.queryToDynamo(
                TABLE_NAME_IS_POSTS,
                "isPostsByStatusAndUpdatedAt",
                "#status = :status",
                undefined,
                { "#status": "status" },
                { ":status": "published" },
                0
            );
            const posts: { slug: string; lastModified: string; }[] = [];
            for (const item of psotItem) {
                posts.push({
                    slug: item.slug,
                    lastModified: item.updatedAt
                });
            }
            const baseURL = process.env.BLOG_BASE_URL || 'https://geinouwasa.com';
            const xmlContent = await generateSitemapXml(posts, baseURL);
            const params = {
                Bucket: BUCKET_NAME_IS_01,
                Key: "public/sitemap.xml",
                Body: xmlContent,
            };
            await s3Client.send(new PutObjectCommand(params));
            break;
        }
    }
    return {
        statusCode: 200,
        body: ""
    };
};


async function updateMainContentTranslation(fileType: string) {
    console.log(fileType);
}


async function generateSitemapXml(posts: { slug: string; lastModified: string; }[], baseURL: string) {
    // XMLドキュメントの作成とルート要素の設定
    const root = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('urlset', { xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9' });
    root.ele('url')
        .ele('loc').txt(baseURL).up()
        .ele('lastmod').txt(new Date().toISOString()).up()
        .up();
    posts.forEach(post => {
        const postUrl = `${baseURL}/posts/${post.slug}`;
        const lastmodIso = new Date(post.lastModified).toISOString(); // 日付オブジェクトに変換してからISO形式を確実にする
        root.ele('url')
            .ele('loc').txt(postUrl).up()
            .ele('lastmod').txt(lastmodIso).up()
            .up();
    });
    return root.end({ prettyPrint: true });
}


// 翻訳関数
async function test(text: string, sourceLanguageCode: string, targetLanguageCode: string) {
    const translateCommand = new TranslateTextCommand({
        Text: text,
        SourceLanguageCode: sourceLanguageCode,
        TargetLanguageCode: targetLanguageCode,
    });
    const translateResponse = await translateClient.send(translateCommand);
    console.log("Translation:", JSON.stringify(translateResponse, null, "\t"));
    return translateResponse;
}


async function scrapingContent(link: string, title: string, outputResults: OutputResult[]) {
    const mainContPromptParts: MainContPromptParts = {
        id: "",
        title,
        category: "",
        tags: [],
        comments: []
    };
    const psotItem = await dynamodbHelpers.queryToDynamo(
        TABLE_NAME_IS_POSTS,
        "isPostsByTitle",
        "#title = :title",
        undefined,
        { "#title": "title" },
        { ":title": title },
        0
    );
    if (psotItem.length) return;
    const res = await axios.get(link, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
    await new Promise(res => setTimeout(res, 1000));
    const postId = uuidv4();
    mainContPromptParts.id = postId;
    const createdAt = dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
    const $ = cheerio.load(res.data);

    // アイキャッチ、OGP画像取得
    const ogImage = $('meta[property="og:image"]').attr("content") as string;
    const ogImageRes = await getImage(ogImage, createdAt);
    console.info("ogImageRes", ogImageRes);

    // スラッグ作成
    let slug = await createSlug(title);
    slug = await checkSlugWithRetry(slug, TABLE_NAME_IS_POSTS, "isPostsBySlug", "#slug = :slug");

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
        const taxonomy = $(el).attr("class")?.trim().replace(/ items/g, "") as string;
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
                const termItem = await dynamodbHelpers.queryToDynamo(
                    TABLE_NAME_IS_TERMS,
                    "isTermsBySlug",
                    "#slug = :slug",
                    undefined,
                    { "#slug": "slug" },
                    { ":slug": slug },
                    0
                );
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

                // メインコンテンツのプロンプトパーツに追加
                taxonomy === "category" ? mainContPromptParts.category = name : mainContPromptParts.tags.push(name);
            }
        }
    });
    await Promise.all(promises);

    // コメントの取得
    const ths = $('#article-header + div div.meta');
    const tds = $('#article-header + div .message');
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
        const promptContent = $(el).text()?.trim().replace(/\r?\n/g, '');
        if (content?.includes("<img")) {
            // 画像が含まれている場合は、画像をS3に保存
            const imgSrc = $(el).find('img').attr('src') as string;
            if (imgSrc) {
                const imageRes = await getImage(imgSrc, createdAt);
                content = content.replace(new RegExp(imgSrc, 'g'), `https://${NEXT_PUBLIC_CLOUDFRONT_DOMAIN}/${imageRes.Key}`);
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
            // メインコンテンツのプロンプトパーツに追加
            mainContPromptParts.comments.push(promptContent as string);
        }
    }

    // コメントの一括登録
    await batchWriteItems(TABLE_NAME_IS_COMMENTS, pushItems);
    // メインコンテンツのプロンプト作成
    await createdMainContentPrompt(mainContPromptParts);

    // 返却
    outputResults.push({
        id: postId,
        title: title,
        rewrittenTitle: ""
    });
};


// コンテンツ作成のプロンプト作成
async function createdMainContentPrompt(mainContPromptParts: MainContPromptParts) {
    const { id, title, category, tags, comments } = mainContPromptParts;
    console.info("createdMainContentPrompt IN:", JSON.stringify(mainContPromptParts));
    if (!title || !category || !tags.length || !comments.length) return;
    const limitedComments = comments
        .filter(comment => !/https?:\/\//i.test(comment))
        .slice(0, 20);

    // メインコンテンツ
    const MAIN_CONTENT_PROMPT = await getObjetS3(`private/prompt/MAIN_CONTENT_PROMPT.txt`) as string;
    const mainContentData = (`${MAIN_CONTENT_PROMPT}\n`).replace("{title}", title)
        .replace("{id}", id)
        .replace("{category}", category)
        .replace("{tags}", `${tags.map(item => `- ${item}`).join("\n")}`)
        .replace("{comments}", `${limitedComments.map(item => `- ${item}`).join("\n")}`);
    await outPutS3(mainContentData, `mainContent_${mainContPromptParts.id}`);

    // ショートコンテンツ
    const SHORT_CONTENT_PROMPT = await getObjetS3(`private/prompt/SHORT_CONTENT_PROMPT.txt`) as string;
    const shortContentData = (`${SHORT_CONTENT_PROMPT}\n`).replace("{title}", title)
        .replace("{id}", id)
        .replace("{category}", category)
        .replace("{tags}", `${tags.map(item => `- ${item}`).join("\n")}`)
        .replace("{comments}", `${limitedComments.map(item => `- ${item}`).join("\n")}`);
    await outPutS3(shortContentData, `shortContent_${mainContPromptParts.id}`);
}


// コメントをバッチ登録する関数
async function batchWriteItems(tableName: string, items: IS_COMMENTS_INPUT[] | IS_COMMENTS_TRANSLATIONS_INPUT[]) {
    console.info("batchWriteItems IN:", items.length);
    // バッチ分割
    const batches = [];
    for (let i = 0; i < items.length; i += MAX_BATCH_SIZE) {
        batches.push(items.slice(i, i + MAX_BATCH_SIZE));
    }
    const putRequestsArray = batches.map(batch => ({
        RequestItems: {
            [tableName]: batch.map(item => ({
                PutRequest: { Item: item as IS_COMMENTS_INPUT | IS_COMMENTS_TRANSLATIONS_INPUT },
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
        const result = await dynamodbHelpers.queryToDynamo(
            tableName,
            indexName,
            keyConditionExpression,
            undefined,
            { "#slug": "slug" },
            { ":slug": slug },
            0
        );
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
    const putResult = await s3Client.send(new PutObjectCommand(putObjParam));
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
async function outPutS3(inputData: any, fileName: string) {
    console.info("outPutS3 IN:", inputData, fileName);
    const params = {
        Bucket: BUCKET_NAME_IS_01,
        Key: `private/edit/${fileName}_${dayjs().format("YYYYMMDDHHmmssSSS")}_prompt.txt`,
        Body: inputData,
    };
    console.info("PutObject REQ", params);
    await s3Client.send(new PutObjectCommand(params));
}


// S3からデータを取得する
async function getObjetS3(Key: string) {
    try {
        const response = await s3Client.send(
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
        try {
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

            // 各言語に翻訳して保存
            for (const lang of ["en", "zh-TW"]) {
                const { TranslatedText } = await test(v.rewrittenTitle, 'ja', lang);
                const param: PutCommandInput = {
                    TableName: TABLE_NAME_IS_POSTS_TRANSLATIONS,
                    Item: {
                        id: uuidv4(),
                        postId: v.id,
                        lang,
                        rewrittenTitle: TranslatedText,
                        createdAt: dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                        updatedAt: dayjs().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
                        __typename: "IsPostsTranslations"
                    }
                };
                console.info("PutCommand param", param);
                await docClient.send(new PutCommand(param));
            }
        } catch (e) {
            console.error("Error updating title:", v, e);
            if ((e as any).errorType === "ValidationException" || (e as any).errorType === "ConditionalCheckFailedException") {
                console.warn(`Item with id ${v.id} does not exist. Skipping update.`);
                continue;
            }
            throw e;
        }
    }
}