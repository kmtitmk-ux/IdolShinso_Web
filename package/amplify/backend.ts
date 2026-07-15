import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { myFirstFunction, myFirstFunctionEnvConfig } from './functions/my-first-function/resource';
import { isSnsFunction } from './functions/is-sns-function/resource';
import { storage } from './storage/resource';
import {
    Effect,
    PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import { createIsRandomSnsWorkflow } from './workflows/is-random-sns/resource';
import { createOrderStatusWorkflow } from './workflows/order-status/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
export const backend = defineBackend({
    auth,
    data,
    myFirstFunction,
    isSnsFunction,
    storage
});

type Branch = "main" | "develop";
const BRANCH: Branch = (process.env.AWS_BRANCH as Branch) || "develop";
const externalStack = backend.createStack("MyExternalDataSources");
const lambdaMyFirstFunctionAttrArn = backend.myFirstFunction.resources.cfnResources.cfnFunction.attrArn;

const { eventBusForStepFunc } = createIsRandomSnsWorkflow(externalStack, backend.isSnsFunction.resources.lambda);
backend.data.addEventBridgeDataSource("MyEventBridgeDataSourceForStepFunc", eventBusForStepFunc);

const { eventBus } = createOrderStatusWorkflow(externalStack, lambdaMyFirstFunctionAttrArn);
backend.data.addEventBridgeDataSource("MyEventBridgeDataSource", eventBus);


/**
 * LambdaのIAMロールにポリシーをアタッチ
 */
const myFirstFunctionRole = backend.myFirstFunction.resources.lambda.role;
myFirstFunctionRole?.addToPrincipalPolicy(
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
            `arn:aws:dynamodb:*:*:table/IsSns*`,
        ]
    })
);
const s3BucketName = process.env.BUCKET_NAME_IS_01 || myFirstFunctionEnvConfig[BRANCH]?.BUCKET_NAME_IS_01;
myFirstFunctionRole?.addToPrincipalPolicy(
    new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
            's3:PutObject',
            's3:GetObject',
            's3:DeleteObject',
            's3:ListBucket'
        ],
        resources: [
            `arn:aws:s3:::${s3BucketName}`,
            `arn:aws:s3:::${s3BucketName}/*`
        ]
    })
);
myFirstFunctionRole?.addToPrincipalPolicy(
    new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['translate:TranslateText'],
        resources: ['*']
    })
);

const isSnsFunctionRole = backend.isSnsFunction.resources.lambda.role;
isSnsFunctionRole?.addToPrincipalPolicy(
    new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:Query',
            'dynamodb:UpdateItem'
        ],
        resources: [
            `arn:aws:dynamodb:*:*:table/IsPosts*`,
            // `arn:aws:dynamodb:*:*:table/IsPostMeta*`,
            // `arn:aws:dynamodb:*:*:table/IsTerms*`,
            // `arn:aws:dynamodb:*:*:table/IsComments*`,
            `arn:aws:dynamodb:*:*:table/IsSns*`,
        ]
    })
);