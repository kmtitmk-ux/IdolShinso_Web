import { defineFunction } from '@aws-amplify/backend';

export const IsArticleAnalytics = defineFunction({
    name: 'IsArticleAnalytics',
    entry: './handler.ts',
    timeoutSeconds: 60,
    environment: {
        BUCKET_NAME_01: process.env.BUCKET_NAME_01 ?? '',
        GOOGLE_ANALYTICS_KEY_BASE64: process.env.GOOGLE_ANALYTICS_KEY_BASE64 ?? '',
        GA4_PROPERTY_ID: process.env.GA4_PROPERTY_ID ?? '',
    },
});
