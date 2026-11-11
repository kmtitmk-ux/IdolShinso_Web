import { defineFunction } from '@aws-amplify/backend';

export const IsCreateFile = defineFunction({
    name: 'IsCreateFile',
    entry: './handler.ts',
    timeoutSeconds: 300,
    resourceGroupName: 'data',
    environment: {
        PRICE_ID: process.env.PRICE_ID || 'price_1UOY9CJrAiZh5XAaw9Dca5Hd',
        TABLE_NAME_SNS_POSTS: process.env.TABLE_NAME_SNS_POSTS || '',
        TABLE_NAME_POSTS: process.env.TABLE_NAME_POSTS || '',
        TABLE_NAME_POST_META: process.env.TABLE_NAME_POST_META || '',
        TABLE_NAME_COMMENTS: process.env.TABLE_NAME_COMMENTS || '',
        TABLE_NAME_POST_ANALYTICS: process.env.TABLE_NAME_POST_ANALYTICS || '',
        BUCKET_NAME_01: process.env.BUCKET_NAME_01 || '',
        KNOWLEDGE_BASE_ID: process.env.KNOWLEDGE_BASE_ID || 'I8TLX7MTA9',
        KB_DATA_SOURCE_ID: process.env.KB_DATA_SOURCE_ID || 'KWBAHX19XU',
    }
});
