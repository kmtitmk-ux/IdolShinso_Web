import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { myFirstFunction, envConfig } from './functions/my-first-function/resource';
import { storage } from './storage/resource';
import { aws_events } from "aws-cdk-lib";
import {
    Effect,
    PolicyDocument,
    PolicyStatement,
    Role,
    ServicePrincipal,
} from "aws-cdk-lib/aws-iam";

import * as events from 'aws-cdk-lib/aws-events';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
export const backend = defineBackend({
    auth,
    data,
    myFirstFunction,
    // storage
});

const eventStack = backend.createStack("MyExternalDataSources");
const eventBus = aws_events.EventBus.fromEventBusName(
    eventStack,
    "MyEventBus",
    "default"
);
backend.data.addEventBridgeDataSource("MyEventBridgeDataSource", eventBus);

const policyStatement = new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["lambda:InvokeFunction"],
    resources: [backend.myFirstFunction.resources.cfnResources.cfnFunction.attrArn],
});

const eventBusRole = new Role(eventStack, "LambdaInvokeRole", {
    assumedBy: new ServicePrincipal("events.amazonaws.com"),
    inlinePolicies: {
        PolicyStatement: new PolicyDocument({
            statements: [policyStatement],
        }),
    },
});

type Branch = "main" | "develop";
const branch: Branch = (process.env.AWS_BRANCH as Branch) || "develop";
const rule = new aws_events.CfnRule(eventStack, "MyOrderRule", {
    eventBusName: eventBus.eventBusName,
    name: process.env.RULE_NAME_IS_01 ?? `broadcastOrderStatusChange-${branch}`,
    state: process.env.RULE_NAME_IS_01 ? "DISABLED" : "ENABLED",
    scheduleExpression: "cron(0 0 ? * * *)",
    targets: [
        {
            id: "orderStatusChangeReceiver",
            arn: backend.myFirstFunction.resources.cfnResources.cfnFunction.attrArn,
            roleArn: eventBusRole.roleArn,
            input: JSON.stringify({ procType: "scrapingContent" })
        }
    ]
});

// 関数のIAMロールにポリシーをアタッチ
const functionRole = backend.myFirstFunction.resources.lambda.role;
functionRole?.addToPrincipalPolicy(
    new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
            'dynamodb:BatchWriteItem',
            'dynamodb:PutItem',
            'dynamodb:Query',
            'dynamodb:UpdateItem'
        ],
        resources: [
            `arn:aws:dynamodb:*:*:table/IsPosts*`,
            `arn:aws:dynamodb:*:*:table/IsPostMeta*`,
            `arn:aws:dynamodb:*:*:table/IsTerms*`,
            `arn:aws:dynamodb:*:*:table/IsComments*`,
        ],
    })
);

const s3BucketName = process.env.BUCKET_NAME_IS_01 || envConfig[branch]?.BUCKET_NAME_IS_01;
functionRole?.addToPrincipalPolicy(
    new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
            's3:PutObject',
            's3:GetObject',
        ],
        resources: [`arn:aws:s3:::${s3BucketName}/*`],
    })
);