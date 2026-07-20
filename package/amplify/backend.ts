import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data, IsCreateFile } from './data/resource';
import { myFirstFunction, myFirstFunctionEnvConfig } from './functions/my-first-function/resource';
import { isSnsFunction } from './functions/is-sns-function/resource';
import { storage } from './storage/resource';
import {
    Effect,
    PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import { createIsRandomSnsWorkflow } from './workflows/is-random-sns/resource';
import { createOrderStatusWorkflow } from './workflows/order-status/resource';
import { createSnsStatsWorkflow } from './workflows/IsSnsStatsWorkflow/resource';
import { createFileWorkflow } from './workflows/IsCreateFileWorkflow/resource';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
export const backend = defineBackend({
    auth,
    data,
    myFirstFunction,
    isSnsFunction,
    IsCreateFile,
    storage
});

const externalStack = backend.createStack("MyExternalDataSources");
const parentStackName = externalStack.nestedStackParent?.stackName ?? externalStack.stackName;
const env = parentStackName.includes("main") ? "main"
    : parentStackName.includes("develop") ? "develop"
        : "sandbox";

// DynamoDB
const isPostsTbl = backend.data.resources.tables['IsPosts'];
const isSnsTbl = backend.data.resources.tables['IsSns'];
const IsPostMetaTbl = backend.data.resources.tables['IsPostMeta'];
const IsTermsTbl = backend.data.resources.tables['IsTerms'];
const IsCommentsTbl = backend.data.resources.tables['IsComments'];
const IsPostsTranslationsTbl = backend.data.resources.tables['IsPostsTranslations'];

// S3
const isBucket01 = backend.storage.resources.bucket;

// Lambda
const lambdaMyFirstFunctionAttrArn = backend.myFirstFunction.resources.cfnResources.cfnFunction.attrArn;

const IsSnsFunctionInstance = backend.isSnsFunction.resources.lambda as LambdaFunction;
const IsCreateFileInstance = backend.IsCreateFile.resources.lambda as LambdaFunction;

IsCreateFileInstance.addEnvironment('TABLE_NAME_SNS_POSTS', isSnsTbl.tableName);
IsCreateFileInstance.addEnvironment('BUCKET_NAME_01', isBucket01.bucketName);

// is-random-sns
const { eventBusForStepFunc } = createIsRandomSnsWorkflow(externalStack, backend.isSnsFunction.resources.lambda);
backend.data.addEventBridgeDataSource("MyEventBridgeDataSourceForStepFunc", eventBusForStepFunc);

// order-status
const { eventBus } = createOrderStatusWorkflow(externalStack, lambdaMyFirstFunctionAttrArn);
backend.data.addEventBridgeDataSource("MyEventBridgeDataSource", eventBus);

createSnsStatsWorkflow(externalStack, { IsSnsFunctionInstance }, env);
createFileWorkflow(externalStack, { IsCreateFileInstance }, env);

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
            isPostsTbl.tableArn,
            `${isPostsTbl.tableArn}/index/*`,
            IsPostMetaTbl.tableArn,
            IsTermsTbl.tableArn,
            `${IsTermsTbl.tableArn}/index/*`,
            IsCommentsTbl.tableArn,
            isSnsTbl.tableArn,
            IsPostsTranslationsTbl.tableArn,
            `${IsPostsTranslationsTbl.tableArn}/index/*`,
        ]
    })
);
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
            `${isBucket01.bucketArn}`,
            `${isBucket01.bucketArn}/*`
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
            isPostsTbl.tableArn,
            `${isPostsTbl.tableArn}/index/*`,
            isSnsTbl.tableArn,
            `${isSnsTbl.tableArn}/index/*`
        ],
    })
);

const IsCreateFileRole = backend.IsCreateFile.resources.lambda.role;
IsCreateFileRole?.addToPrincipalPolicy(
    new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
            'dynamodb:PutItem',
            'dynamodb:Query',
        ],
        resources: [
            isSnsTbl.tableArn,
            `${isSnsTbl.tableArn}/index/*`
        ],
    })
);
IsCreateFileRole?.addToPrincipalPolicy(
    new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
        resources: [`${isBucket01.bucketArn}/*`],
    })
);