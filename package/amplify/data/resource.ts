import { type ClientSchema, a, defineData, defineFunction, secret } from '@aws-amplify/backend';
/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any unauthenticated user can "create", "read", "update",
and "delete" any "Todo" records.
=========================================================================*/

export const IsWebhook = defineFunction({
    name: "IsWebhook",
    entry: "../functions/IsWebhook/handler.ts",
    resourceGroupName: 'data',
    timeoutSeconds: 15,
    environment: {
        STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
        STRIPE_WEBHOOK_SECRET: secret('STRIPE_WEBHOOK_SECRET'),
        SITE_URL: process.env.SITE_URL || 'https://geinouwasa.com',
    }
});

export const IsPayment = defineFunction({
    name: "IsPayment",
    entry: "../functions/IsPayment/handler.ts",
    resourceGroupName: 'data',
    timeoutSeconds: 15,
    environment: {
        STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
        STRIPE_WEBHOOK_SECRET: secret('STRIPE_WEBHOOK_SECRET'),
        SITE_URL: process.env.SITE_URL || 'https://geinouwasa.com',
    }
});

const IsPosts = {
    rewrittenTitle: a.string(),
    content: a.string(),
    status: a.string().required(),
};
const IsTerms = {
    name: a.string().required()
};
const IsComments = {
    postId: a.id(),
    header: a.string(),
    content: a.string(),
    createdAt: a.datetime().required(),
    post: a.belongsTo('IsPosts', 'postId')
};
const schema = a.schema({
    IsPosts: a
        .model({
            ...IsPosts,
            createdAt: a.datetime().required(),
            excerpt: a.string(),
            s3Key: a.string(),
            slug: a.string().required(),
            thumbnail: a.string(),
            title: a.string().required(),
            updatedAt: a.datetime().required(),
            comments: a.hasMany('IsComments', 'postId'),
            commentsTranslations: a.hasMany('IsCommentsTranslations', 'postId'),
            postmeta: a.hasMany('IsPostMeta', 'postId'),
            postsTranslations: a.hasMany('IsPostsTranslations', 'postId'),
            postAnalytics: a.hasMany('IsPostAnalytics', 'postId'),
            priceId: a.string(),
            sns: a.hasMany('IsSns', 'postId'),
            visibility: a.enum(['public', 'members', 'paid'])
        })
        .secondaryIndexes((index) => [
            index('title'),
            index('slug'),
            index('status').sortKeys(['createdAt']),
            index('status').sortKeys(['updatedAt'])
        ])
        .authorization((allow) => [allow.guest().to(['read']), allow.authenticated().to(['read'])]),
    IsPostMeta: a
        .model({
            createdAt: a.datetime().required(),
            postId: a.id(),
            name: a.string().required(),
            slug: a.string().required(),
            taxonomy: a.string().required(),
            slugTaxonomy: a.string().required(),
            post: a.belongsTo('IsPosts', 'postId'),
        })
        .secondaryIndexes((index) => [
            index('slugTaxonomy').sortKeys(['createdAt'])
        ])
        .authorization((allow) => [allow.guest().to(['read'])]),
    IsPurchases: a.model({
        userId: a.string().required(),
        postId: a.id().required(),
        stripeSessionId: a.string().required(),
        amount: a.integer(),
        purchasedAt: a.datetime(),
    })
        .identifier(['userId', 'postId']) // 同じ記事の二重購入を構造的に防げる
        .secondaryIndexes((index) => [
            index('stripeSessionId'), // Webhook の冪等チェック用
        ])
        .authorization((allow) => [
            allow.ownerDefinedIn('userId').to(['read']),
        ]),
    IsTerms: a
        .model({
            ...IsTerms,
            slug: a.string().required(),
            taxonomy: a.string().required(),
            termsTranslations: a.hasMany('IsTermsTranslations', 'termId')
        })
        .secondaryIndexes((index) => [
            index('slug'),
            index('taxonomy')
        ])
        .authorization((allow) => [allow.guest().to(['read'])]),
    IsComments: a
        .model({
            ...IsComments,
        })
        .secondaryIndexes((index) => [
            index('postId').sortKeys(['createdAt'])
        ])
        .authorization((allow) => [allow.guest().to(['read']), allow.authenticated().to(['read'])]),
    IsPostsTranslations: a
        .model({
            ...IsPosts,
            lang: a.string().required(),
            postId: a.id(),
            post: a.belongsTo('IsPosts', 'postId')
        })
        .secondaryIndexes((index) => [
            index('postId')
        ])
        .authorization((allow) => [allow.guest().to(['read']), allow.authenticated().to(['read'])]),
    IsTermsTranslations: a
        .model({
            ...IsTerms,
            termId: a.id(),
            lang: a.string().required(),
            term: a.belongsTo('IsTerms', 'termId')
        })
        .secondaryIndexes((index) => [
            index('lang')
        ])
        .authorization((allow) => [allow.guest().to(['read'])]),
    IsCommentsTranslations: a
        .model({
            ...IsComments,
            lang: a.string().required()
        })
        .secondaryIndexes((index) => [
            index('postId').sortKeys(['createdAt'])
        ])
        .authorization((allow) => [allow.guest().to(['read'])]),
    IsSns: a
        .model({
            contentText: a.string(),
            createdAt: a.datetime(),
            crossPosted: a.boolean(),
            engagementRate: a.float(),
            lang: a.string().required(),
            originalPostId: a.string(),
            postId: a.id(),
            post: a.belongsTo('IsPosts', 'postId'),
            platform: a.string(),
            replyContent: a.string(),
            s3Key: a.string(),
            snsPostId: a.string(),
            status: a.string().required(),
            type: a.string().required(),
            updatedAt: a.datetime(),
        })
        .secondaryIndexes((index) => [
            index('status').sortKeys(['updatedAt']),
            index('platform').sortKeys(['updatedAt']),
            index('platform').sortKeys(['createdAt']),
            index('originalPostId').sortKeys(['createdAt'])
        ])
        .authorization((allow) => [allow.guest().to(['read'])]),
    IsUsers: a
        .model({
            email: a.string().required(),
            createdAt: a.string().required(),
            plan: a.enum(['free', 'premium']),
            role: a.enum(['user', 'admin'])
        })
        .secondaryIndexes((index) => [
            index('email').sortKeys(['role'])
        ])
        .authorization((allow) => [allow.owner()]),
    IsPostAnalytics: a.model({
        postId: a.id(),
        averageEngagementTime: a.integer().required(),
        pageViews: a.integer().required(),
        periodStart: a.string().required(),
        periodEnd: a.string().required(),
        post: a.belongsTo('IsPosts', 'postId'),
    })
        .authorization((allow) => [allow.guest().to(['read']), allow.authenticated().to(['read'])]),

    IsFunctionPayment: a
        .mutation()
        .arguments({
            productId: a.string().required(),
        })
        .returns(a.string())
        .handler(a.handler.function(IsPayment))
        .authorization(allow => [
            allow.authenticated()
        ])
}).authorization((allow) => [
    allow.resource(IsPayment),
    allow.resource(IsWebhook),
]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
    schema,
    authorizationModes: {
        defaultAuthorizationMode: 'identityPool',
    },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
