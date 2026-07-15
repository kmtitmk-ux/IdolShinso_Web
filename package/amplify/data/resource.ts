import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any unauthenticated user can "create", "read", "update", 
and "delete" any "Todo" records.
=========================================================================*/

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
            slug: a.string().required(),
            thumbnail: a.string(),
            title: a.string().required(),
            updatedAt: a.datetime().required(),
            comments: a.hasMany('IsComments', 'postId'),
            commentsTranslations: a.hasMany('IsCommentsTranslations', 'postId'),
            postmeta: a.hasMany('IsPostMeta', 'postId'),
            postsTranslations: a.hasMany('IsPostsTranslations', 'postId'),
            sns: a.hasMany('IsSns', 'postId')
        })
        .secondaryIndexes((index) => [
            index('title'),
            index('slug'),
            index('status').sortKeys(['createdAt']),
            index('status').sortKeys(['updatedAt'])
        ])
        .authorization((allow) => [allow.guest()]),
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
        .authorization((allow) => [allow.guest()]),
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
        .authorization((allow) => [allow.guest()]),
    IsComments: a
        .model({
            ...IsComments,
        })
        .secondaryIndexes((index) => [
            index('postId').sortKeys(['createdAt'])
        ])
        .authorization((allow) => [allow.guest()]),
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
        .authorization((allow) => [allow.guest()]),
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
        .authorization((allow) => [allow.guest()]),
    IsCommentsTranslations: a
        .model({
            ...IsComments,
            lang: a.string().required()
        })
        .secondaryIndexes((index) => [
            index('postId').sortKeys(['createdAt'])
        ])
        .authorization((allow) => [allow.guest()]),
    IsSns: a
        .model({
            contentText: a.string(),
            postId: a.id(),
            platform: a.string(),
            snsPostId: a.string(),
            status: a.string().required(),
            updatedAt: a.datetime(),
            post: a.belongsTo('IsPosts', 'postId'),
            lang: a.string().required()
        })
        .secondaryIndexes((index) => [
            index('status').sortKeys(['updatedAt']),
        ])
        .authorization((allow) => [allow.guest()]),
});

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
