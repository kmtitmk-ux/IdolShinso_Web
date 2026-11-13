import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import type { Schema } from '../../data/resource.js';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(process.env as any);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: Schema['IsFunctionGetPaidContent']['functionHandler'] = async (event) => {
    // Cognito の sub(ユーザーID)
    const identity = event.identity as { sub?: string; } | null;
    const userId = identity?.sub;
    if (!userId) {
        throw new Error('Unauthorized');
    }

    const { postId } = event.arguments;
    const { data: purchase, errors: purchaseErrors } = await client.models.IsPurchases.get({ userId, postId });

    if (purchaseErrors) {
        console.error(purchaseErrors);
        throw new Error('Internal error');
    }
    if (!purchase) {
        throw new Error('Forbidden: not purchased');
    }

    // 2. 購入済みなら content だけ返す
    const { data: post, errors: postErrors } = await client.models.IsPosts.get({ id: postId });

    if (postErrors) {
        console.error(postErrors);
        throw new Error('Internal error');
    }
    if (!post) {
        throw new Error('Not found');
    }

    return post.content ?? '';
};
