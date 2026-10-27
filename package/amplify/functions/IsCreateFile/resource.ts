import { defineFunction } from '@aws-amplify/backend';

export const IsCreateFile = defineFunction({
    name: 'IsCreateFile',
    entry: './handler.ts',
    timeoutSeconds: 300,
});
