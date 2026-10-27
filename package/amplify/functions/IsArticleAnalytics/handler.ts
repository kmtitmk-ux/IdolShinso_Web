
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    PutCommand,
    PutCommandInput,
    DynamoDBDocumentClient
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid';
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import type { Schema } from "../../data/resource";
import type { Handler } from 'aws-lambda';

// 環境変数
const BUCKET_NAME_01 = process.env.BUCKET_NAME_01 as string;
const GOOGLE_ANALYTICS_KEY_BASE64 = process.env.GOOGLE_ANALYTICS_KEY_BASE64 ?? "";
const GA4_PROPERTY_ID: string = process.env.GA4_PROPERTY_ID ?? "";
const TABLE_NAME_ARTICLE_ANALYTICS: string = process.env.TABLE_NAME_ARTICLE_ANALYTICS ?? "";

type ArticleAnalyticsItem = Omit<Schema["IsPostAnalytics"]["type"], "post">;
type AnalyticsList = {
    pagePath: string;
    averageEngagementTime: number;
    pageViews: number;
};
type Articles = {
    id: string;
    title: string;
    updatedAt: string;
    terms: string[];
};

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});

const credentials = JSON.parse(
    Buffer.from(
        GOOGLE_ANALYTICS_KEY_BASE64,
        "base64"
    ).toString("utf8")
);
const analyticsDataClient = new BetaAnalyticsDataClient({
    credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
    },
});
export const handler: Handler = async (event) => {
    console.info(`EVENT: ${JSON.stringify(event).replaceAll("\r", " ").replaceAll("\n", " ")}`);
    try {
        const articlesRes = await s3Client.send(new GetObjectCommand({
            Bucket: BUCKET_NAME_01,
            Key: "private/articles.json",
        }));
        const articles = JSON.parse(await articlesRes.Body!.transformToString());
        const analytics7d = await getArticleAnalytics("7daysAgo", "yesterday");
        await saveAnalytics(analytics7d.items, analytics7d.periodStart, analytics7d.periodEnd, articles);
        return { statusCode: 200, body: "" };
    } catch (error) {
        console.error(error);
    }
};

function resolveDate(date: string): string {
    const d = new Date();
    const match = date.match(/^(\d+)daysAgo$/);
    if (match) {
        d.setDate(d.getDate() - Number(match[1]));
    } else if (date === "yesterday") {
        d.setDate(d.getDate() - 1);
    } else if (date === "today") {
        // no-op
    } else {
        return date;
    }
    return d.toISOString().slice(0, 10);
}

async function getArticleAnalytics(startDate: string, endDate: string) {
    const periodStart = resolveDate(startDate);
    const periodEnd = resolveDate(endDate);
    const [response] = await analyticsDataClient.runReport({
        property: `properties/${GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "pagePath" }],
        metrics: [
            { name: "screenPageViews" },
            { name: "userEngagementDuration" },
            { name: "activeUsers" },
        ]
    });
    console.info("runReport", JSON.stringify(response.rows, null, "\t"));

    const items = (response.rows ?? [])
        .map((row) => {
            const pagePath = row.dimensionValues?.[0]?.value ?? "";
            const pageViews = Number(row.metricValues?.[0]?.value ?? 0);
            const userEngagementDuration = Number(row.metricValues?.[1]?.value ?? 0);
            const activeUsers = Number(row.metricValues?.[2]?.value ?? 0);
            const averageEngagementTime =
                activeUsers > 0
                    ? userEngagementDuration / activeUsers
                    : 0;

            return {
                pagePath,
                pageViews,
                userEngagementDuration,
                activeUsers,
                averageEngagementTime,
            };
        });

    return { items, periodStart, periodEnd };
}

async function saveAnalytics(analyticsList: AnalyticsList[], periodStart: string, periodEnd: string, articles: Articles[]) {
    console.info("saveAnalytics", { analyticsList, periodStart, periodEnd, articles });
    await Promise.all(
        analyticsList.map(async (analytics) => {
            const postId = analytics.pagePath.split("/").pop() ?? "";
            const post = articles.find(
                (art) => art.id === postId
            );
            if (!post) return;
            const now = new Date().toISOString();
            const newItem: ArticleAnalyticsItem = {
                id: uuidv4(),
                postId,
                averageEngagementTime: analytics.averageEngagementTime,
                createdAt: now,
                periodStart,
                periodEnd,
                pageViews: analytics.pageViews,
                updatedAt: now,
            };
            await docClient.send(
                new PutCommand({
                    TableName: TABLE_NAME_ARTICLE_ANALYTICS,
                    Item: newItem,
                } as PutCommandInput)
            );
        })
    );
}
