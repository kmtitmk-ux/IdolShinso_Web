import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data, IsCreateFile } from './data/resource';
import { myFirstFunction } from './functions/my-first-function/resource';
import { IsSocialProcessor } from './functions/IsSocialProcessor/resource';
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
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
export const backend = defineBackend({
    auth,
    data,
    myFirstFunction,
    IsSocialProcessor,
    IsCreateFile,
    storage
});

const NEXT_PUBLIC_CLOUDFRONT_DOMAIN = process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN as string;

const externalStack = backend.createStack("MyExternalDataSources");
const parentStackName = externalStack.nestedStackParent?.stackName ?? externalStack.stackName;
const env = parentStackName.includes("main") ? "main"
    : parentStackName.includes("develop") ? "develop"
        : "sandbox";

// DynamoDB
const isPostsTbl = backend.data.resources.tables['IsPosts'];
const isSnsTbl = backend.data.resources.tables['IsSns'];
const isPostMetaTbl = backend.data.resources.tables['IsPostMeta'];
const isTermsTbl = backend.data.resources.tables['IsTerms'];
const isCommentsTbl = backend.data.resources.tables['IsComments'];
const isPostsTranslationsTbl = backend.data.resources.tables['IsPostsTranslations'];

// S3
const storageStack = backend.storage.resources.bucket.stack;
const isBucket01 = backend.storage.resources.bucket;

// Lambda
const lambdaMyFirstFunctionAttrArn = backend.myFirstFunction.resources.cfnResources.cfnFunction.attrArn;
const IsMyFirstFunctionInstance = backend.myFirstFunction.resources.lambda as LambdaFunction;
IsMyFirstFunctionInstance.addEnvironment('NEXT_PUBLIC_CLOUDFRONT_DOMAIN', NEXT_PUBLIC_CLOUDFRONT_DOMAIN);
IsMyFirstFunctionInstance.addEnvironment('TABLE_NAME_IS_POSTS', isPostsTbl.tableName);
IsMyFirstFunctionInstance.addEnvironment('TABLE_NAME_IS_POSTMETA', isPostMetaTbl.tableName);
IsMyFirstFunctionInstance.addEnvironment('TABLE_NAME_IS_TERMS', isTermsTbl.tableName);
IsMyFirstFunctionInstance.addEnvironment('TABLE_NAME_IS_COMMENTS', isCommentsTbl.tableName);
IsMyFirstFunctionInstance.addEnvironment('TABLE_NAME_IS_POSTS_TRANSLATIONS', isPostsTranslationsTbl.tableName);
IsMyFirstFunctionInstance.addEnvironment('TABLE_NAME_IS_SNS', isSnsTbl.tableName);
IsMyFirstFunctionInstance.addEnvironment('BUCKET_NAME_IS_01', isBucket01.bucketName);

const IsSocialProcessorInstance = backend.IsSocialProcessor.resources.lambda as LambdaFunction;
IsSocialProcessorInstance.addEnvironment('TABLE_NAME_SNS_POSTS', isSnsTbl.tableName);
IsSocialProcessorInstance.addEnvironment('TABLE_NAME_POSTS', isPostsTbl.tableName);
IsSocialProcessorInstance.addEnvironment('BUCKET_NAME_01', isBucket01.bucketName);
IsSocialProcessorInstance.addEnvironment('GOOGLE_SPREADSHEET_ID_SNS', "1nJ0RW0CadVS6P_fqAv4Psu9k1vwPIGe8Eou5iwfaYuA");
isSnsTbl.grantReadWriteData(IsSocialProcessorInstance);

const IsCreateFileInstance = backend.IsCreateFile.resources.lambda as LambdaFunction;
IsCreateFileInstance.addEnvironment('TABLE_NAME_SNS_POSTS', isSnsTbl.tableName);
IsCreateFileInstance.addEnvironment('TABLE_NAME_POSTS', isPostsTbl.tableName);
IsCreateFileInstance.addEnvironment('BUCKET_NAME_01', isBucket01.bucketName);

// is-random-sns
const { eventBusForStepFunc } = createIsRandomSnsWorkflow(externalStack, backend.IsSocialProcessor.resources.lambda);
backend.data.addEventBridgeDataSource("MyEventBridgeDataSourceForStepFunc", eventBusForStepFunc);

// order-status
const { eventBus } = createOrderStatusWorkflow(externalStack, lambdaMyFirstFunctionAttrArn);
backend.data.addEventBridgeDataSource("MyEventBridgeDataSource", eventBus);

createSnsStatsWorkflow(externalStack, { IsSocialProcessorInstance }, env);
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
            isPostMetaTbl.tableArn,
            isTermsTbl.tableArn,
            `${isTermsTbl.tableArn}/index/*`,
            isCommentsTbl.tableArn,
            isSnsTbl.tableArn,
            isPostsTranslationsTbl.tableArn,
            `${isPostsTranslationsTbl.tableArn}/index/*`,
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

const IsSocialProcessorRole = backend.IsSocialProcessor.resources.lambda.role;
IsSocialProcessorRole?.addToPrincipalPolicy(
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
            'dynamodb:UpdateItem',
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

// CloudFront ディストリビューションの作成（OAC方式、public/* のみ配信）
const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(isBucket01);
const imageDistribution = new cloudfront.Distribution(storageStack, 'ImageDistribution', {
    defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [{
            function: new cloudfront.Function(storageStack, 'PublicPathGuard', {
                code: cloudfront.FunctionCode.fromInline(`
                    function handler(event) {
                        var uri = event.request.uri;
                        if (!uri.startsWith('/public/')) {
                            return { statusCode: 403, statusDescription: 'Forbidden' };
                        }
                        return event.request;
                    }
                `),
            }),
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST
        }]
    }
});
