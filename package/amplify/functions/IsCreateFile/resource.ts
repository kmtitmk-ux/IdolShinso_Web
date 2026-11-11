import { defineFunction } from '@aws-amplify/backend';

export const IsCreateFile = defineFunction({
    name: 'IsCreateFile',
    entry: './handler.ts',
    timeoutSeconds: 300,
    resourceGroupName: 'data',
    environment: {
        PRICE_ID: process.env.PRICE_ID || 'price_1UOY9CJrAiZh5XAaw9Dca5Hd'
    }
});
