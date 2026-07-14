import { Stack } from "aws-cdk-lib";
import { aws_events } from "aws-cdk-lib";
import {
    Effect,
    PolicyDocument,
    PolicyStatement,
    Role,
    ServicePrincipal,
} from "aws-cdk-lib/aws-iam";

type Branch = "main" | "develop";
const BRANCH: Branch = (process.env.AWS_BRANCH as Branch) || "develop";

/**
 * コンテンツ生成ワークフロー
 * EventBridge スケジュールで毎日 0 時(UTC) に myFirstFunction を呼び出す
 * スクレイピングとサイトマップ生成を並列ターゲットとして実行する
 */
export function createOrderStatusWorkflow(
    stack: Stack,
    lambdaMyFirstFunctionAttrArn: string
) {
    // EventBridge が Lambda を直接起動するための IAM ロール
    const eventBusRole = new Role(stack, "EventBridgeInvokeLambdaRole", {
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

    const eventBus = aws_events.EventBus.fromEventBusName(stack, "MyEventBus", "default");

    // スケジュール: 毎日 0 時(UTC) に2つのターゲットを並列起動
    new aws_events.CfnRule(stack, "OrderStatusRule", {
        eventBusName: eventBus.eventBusName,
        name: process.env.RULE_NAME_IS_01 ?? `is-processOrderStatusChange-${BRANCH}`,
        scheduleExpression: "cron(0 0 ? * * *)",
        state: BRANCH === "main" ? "ENABLED" : "DISABLED",
        targets: [
            {
                // コンテンツのスクレイピング処理
                id: "ProcessOrderTarget",
                arn: lambdaMyFirstFunctionAttrArn,
                roleArn: eventBusRole.roleArn,
                input: JSON.stringify({ procType: "scrapingContent" }),
            },
            {
                // サイトマップの生成処理
                id: "IsCreateSitemap",
                arn: lambdaMyFirstFunctionAttrArn,
                roleArn: eventBusRole.roleArn,
                input: JSON.stringify({ procType: "createSitemap" }),
            },
        ],
    });

    return { eventBus };
}
