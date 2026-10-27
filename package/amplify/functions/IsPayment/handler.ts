import Stripe from 'stripe';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import type { Schema } from '../../data/resource.js';

const env = process.env as unknown as {
    AMPLIFY_DATA_DEFAULT_NAME: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    AWS_SESSION_TOKEN: string;
    AWS_REGION: string;
    STRIPE_SECRET_KEY: string;
    SITE_URL: string;
};

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();
const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export const handler: Schema['IsFunctionPayment']['functionHandler'] = async (event) => {
    console.info(`EVENT: ${JSON.stringify(event)}`);
    const { productId } = event.arguments;
    const identity = event.identity as { sub?: string; claims?: { email?: string } } | null;
    const userId = identity?.sub;
    console.log('identity', JSON.stringify(identity));
    console.log('productId', productId);
    if (!userId) throw new Error('Unauthorized');

    const { data: post } = await client.models.IsPosts.get({ id: productId });
    console.log('post', JSON.stringify(post));
    if (!post?.priceId) throw new Error('Product not found');

    const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: post.priceId, quantity: 1 }],
        client_reference_id: userId,
        metadata: { user_id: userId, post_id: productId },
        customer_email: identity?.claims?.email,
        success_url: `${env.SITE_URL}/posts/${post.slug}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.SITE_URL}/posts/${post.slug}`,
    });

    return session.url;
};
