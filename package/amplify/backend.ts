import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { myFirstFunction, myFirstFunctionEnvConfig } from './functions/my-first-function/resource';
import { isSnsFunction } from './functions/is-sns-function/resource';
import { storage } from './storage/resource';
import { aws_events, aws_stepfunctions } from "aws-cdk-lib";
import {
    Effect,
    PolicyDocument,
    PolicyStatement,
    Role,
    ServicePrincipal,
} from "aws-cdk-lib/aws-iam";

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

const APP_ID = process.env.AWS_APP_ID || "dtb1zhx1jvcon";
type Branch = "main" | "develop";
const BRANCH: Branch = (process.env.AWS_BRANCH as Branch) || "develop";
const externalStack = backend.createStack("MyExternalDataSources");
const lambdaMyFirstFunctionAttrArn = backend.myFirstFunction.resources.cfnResources.cfnFunction.attrArn;
const lambdaIsSnsFunctionAttrArn = backend.isSnsFunction.resources.cfnResources.cfnFunction.attrArn;
const StepFunctions = backend;


/**
 * StepFunctions ステートマシーン作成
 */

// ステートマシーンのロールを作成
const IsLambdaInvokerBusRole = new Role(externalStack, "IsLambdaInvoker", {
    assumedBy: new ServicePrincipal("states.amazonaws.com"),
    inlinePolicies: {
        LambdaInvokePolicy: new PolicyDocument({
            statements: [
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ["lambda:InvokeFunction"],
                    resources: [lambdaIsSnsFunctionAttrArn],
                }),
            ],
        }),
    },
});
const IsRandomSnsLambdaInvoker = new aws_stepfunctions.CfnStateMachine(externalStack, 'IsRandomSnsLambdaInvoker', {
    definitionString: JSON.stringify(
        {
            "StartAt": "GenerateWaitAndNextStep",
            "States": {
                "GenerateWaitAndNextStep": {
                    "Type": "Pass",
                    "Parameters": {
                        "waitSeconds.$": "States.MathAdd(States.MathRandom(5, 30), 0)",
                        "nextStep": "RunPostSns"
                    },
                    "ResultPath": "$.wait",
                    "Next": "WaitState"
                },
                "WaitState": {
                    "Type": "Wait",
                    "SecondsPath": "$.wait.waitSeconds",
                    "Next": "BranchStep"
                },
                "BranchStep": {
                    "Type": "Choice",
                    "Choices": [
                        {
                            "Variable": "$.wait.nextStep",
                            "StringEquals": "RunPostSns",
                            "Next": "RunPostSns"
                        },
                        {
                            "Variable": "$.wait.nextStep",
                            "StringEquals": "RunCheckSns",
                            "Next": "RunCheckSns"
                        }
                    ],
                    "Default": "Fallback"
                },
                "RunPostSns": {
                    "Type": "Task",
                    "Resource": lambdaIsSnsFunctionAttrArn,
                    "Parameters": {
                        "procType": "postSns"
                    },
                    "ResultPath": "$.wait",
                    "Next": "SetNextStepToCheckSns"
                },
                "SetNextStepToCheckSns": {
                    "Type": "Pass",
                    "Parameters": {
                        "waitSeconds.$": "States.MathAdd(States.MathRandom(5, 30), 0)",
                        "nextStep": "RunCheckSns"
                    },
                    "ResultPath": "$.wait",
                    "Next": "WaitState"
                },
                "RunCheckSns": {
                    "Type": "Task",
                    "Resource": lambdaIsSnsFunctionAttrArn,
                    "Parameters": {
                        "procType": "checkSns"
                    },
                    "End": true
                },
                "Fallback": {
                    "Type": "Pass",
                    "End": true
                }
            }
        }
    ),
    roleArn: IsLambdaInvokerBusRole.roleArn,
});


/**
 * EventBridge から StepFunctions を呼び出す設定
 */
// EventBridgeのIAM ロールを作成
const eventBusForStepFuncRole = new Role(externalStack, "EventBridgeInvokeStepFuncRole", {
    assumedBy: new ServicePrincipal("events.amazonaws.com"),
    inlinePolicies: {
        StepFunctionInvokePolicy: new PolicyDocument({
            statements: [
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ["states:StartExecution"],
                    resources: [IsRandomSnsLambdaInvoker.attrArn],
                }),
            ],
        }),
    },
});
const eventBusForStepFunc = aws_events.EventBus.fromEventBusName(
    externalStack,
    "MyEventBusForStepFunc",
    "default"
);
backend.data.addEventBridgeDataSource("MyEventBridgeDataSourceForStepFunc", eventBusForStepFunc);
new aws_events.CfnRule(externalStack, "StepFunctionTriggerRule", {
    eventBusName: eventBusForStepFunc.eventBusName,
    name: process.env.RULE_NAME_IS_02 ?? `triggerStepFunction-${APP_ID}-${BRANCH}`,
    scheduleExpression: "cron(0 0,6 ? * * *)",
    state: BRANCH === "main" ? "ENABLED" : "DISABLED",
    targets: [
        {
            id: "TriggerStepFunctionTarget",
            arn: IsRandomSnsLambdaInvoker.attrArn,
            roleArn: eventBusForStepFuncRole.roleArn,
        }
    ]
});


/**
 * EventBridge から Lambda を呼び出す設定
 */
// EventBridgeのIAM ロールを作成
const eventBusRole = new Role(externalStack, "EventBridgeInvokeLambdaRole", {
    assumedBy: new ServicePrincipal("events.amazonaws.com"),
    inlinePolicies: {
        LambdaInvokePolicy: new PolicyDocument({
            statements: [
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ["lambda:InvokeFunction"],
                    resources: [lambdaMyFirstFunctionAttrArn],
                }),
            ],
        }),
    },
});
const eventBus = aws_events.EventBus.fromEventBusName(
    externalStack,
    "MyEventBus",
    "default"
);
backend.data.addEventBridgeDataSource("MyEventBridgeDataSource", eventBus);
new aws_events.CfnRule(externalStack, "OrderStatusRule", {
    eventBusName: eventBus.eventBusName,
    name: process.env.RULE_NAME_IS_01 ?? `processOrderStatusChange-${APP_ID}-${BRANCH}`,
    scheduleExpression: "cron(0 0 ? * * *)",
    state: BRANCH === "main" ? "ENABLED" : "DISABLED",
    targets: [
        {
            id: "ProcessOrderTarget",
            arn: lambdaMyFirstFunctionAttrArn,
            roleArn: eventBusRole.roleArn,
            input: JSON.stringify({ procType: "scrapingContent" })
        },
        {
            id: "IsCreateSitemap",
            arn: lambdaMyFirstFunctionAttrArn,
            roleArn: eventBusRole.roleArn,
            input: JSON.stringify({ procType: "createSitemap" })
        }
    ]
});


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