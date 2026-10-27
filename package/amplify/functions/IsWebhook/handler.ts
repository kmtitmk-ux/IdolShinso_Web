import Stripe from 'stripe';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import type { Schema } from '../../data/resource.js';
import type { APIGatewayProxyHandler } from 'aws-lambda';

const env = process.env as unknown as {
    AMPLIFY_DATA_DEFAULT_NAME: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    AWS_SESSION_TOKEN: string;
    AWS_REGION: string;
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    SITE_URL: string;
};

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();
const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export const handler: APIGatewayProxyHandler = async (event) => {
    console.info(`EVENT: ${JSON.stringify(event)}`);
    const sig =
        Object.entries(event.headers ?? {}).find(
            ([k]) => k.toLowerCase() === 'stripe-signature'
        )?.[1];
    if (!sig) return { statusCode: 400, body: 'Missing signature' };

    // base64エンコードされて届く場合に備える
    const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
        : (event.body ?? '');

    let stripeEvent: Stripe.Event;
    try {
        stripeEvent = stripe.webhooks.constructEvent(
            rawBody,
            sig,
            env.STRIPE_WEBHOOK_SECRET
        );
    } catch {
        return { statusCode: 400, body: 'Invalid signature' };
    }

    if (
        stripeEvent.type === 'checkout.session.completed' ||
        stripeEvent.type === 'checkout.session.async_payment_succeeded'
    ) {
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== 'paid') {
            return { statusCode: 200, body: 'not paid yet' };
        }


        const userId = session.metadata?.user_id;
        const postId = session.metadata?.post_id;
        if (!userId || !postId) {
            console.error('metadata missing', session.id);
            return { statusCode: 200, body: 'ignored' }; // 再送しても直らないので200
        }

        const { errors } = await client.models.IsPurchases.create({
            userId,
            postId,
            stripeSessionId: session.id,
            amount: session.amount_total ?? 0,
            purchasedAt: new Date().toISOString(),
        });

        if (errors?.length) {
            // 重複(再送)による条件付き書き込みエラーは成功扱いにする
            const duplicate = errors.some((e) =>
                /conditional/i.test(e.message ?? '')
            );
            if (!duplicate) {
                console.error('DB save failed', errors);
                return { statusCode: 500, body: 'db error' }; // Stripeが再送する
            }
        }
    }

    return { statusCode: 200, body: 'ok' };
};
