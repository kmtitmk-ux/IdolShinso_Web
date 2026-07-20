import { Stack, Duration } from "aws-cdk-lib";
import { aws_events, aws_stepfunctions as sfn, aws_stepfunctions_tasks as tasks } from "aws-cdk-lib";
import { IFunction } from "aws-cdk-lib/aws-lambda";
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
 * SNS投稿ワークフロー
 * EventBridge スケジュールで定期起動し、StepFunctions 経由で isSnsFunction を呼び出す
 * フロー: ランダム待機時間生成 → 待機 → Threads投稿 → X投稿
 */
export function createIsRandomSnsWorkflow(stack: Stack, isSnsFunction: IFunction) {
    // 待機秒数(5〜30秒のランダム)と次ステップ名を生成
    const generateWait = new sfn.Pass(stack, "GenerateWaitAndNextStep", {
        parameters: {
            "waitSeconds.$": "States.MathAdd(States.MathRandom(5, 30), 0)",
        },
        resultPath: "$.wait",
    });

    // $.wait.waitSeconds 秒間待機
    const waitState = new sfn.Wait(stack, "WaitState", {
        time: sfn.WaitTime.secondsPath("$.wait.waitSeconds"),
    });

    // SNS投稿処理を実行し、次ステップをチェックに切り替える準備へ
    const runPostThreads = new tasks.LambdaInvoke(stack, "runPostThreads", {
        lambdaFunction: isSnsFunction,
        payload: sfn.TaskInput.fromObject({ procType: "threadsPost" }),
        resultPath: sfn.JsonPath.DISCARD,
    });

    // SNS投稿処理を実行し、次ステップをチェックに切り替える準備へ
    const runPostX = new tasks.LambdaInvoke(stack, "runPostX", {
        lambdaFunction: isSnsFunction,
        payload: sfn.TaskInput.fromObject({ procType: "xPost" }),
        resultPath: sfn.JsonPath.DISCARD,
    });

    const definition = generateWait
        .next(waitState)
        .next(runPostThreads)
        .next(runPostX);

    const stateMachine = new sfn.StateMachine(stack, "IsRandomSnsLambdaInvoker", {
        definitionBody: sfn.DefinitionBody.fromChainable(definition),
    });

    // EventBridge が StepFunctions を起動するための IAM ロール
    const eventBusForStepFuncRole = new Role(stack, "EventBridgeInvokeStepFuncRole", {
        assumedBy: new ServicePrincipal("events.amazonaws.com"),
        inlinePolicies: {
            StepFunctionInvokePolicy: new PolicyDocument({
                statements: [
                    new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ["states:StartExecution"],
                        resources: [stateMachine.stateMachineArn],
                    }),
                ],
            }),
        },
    });

    const eventBusForStepFunc = aws_events.EventBus.fromEventBusName(stack, "MyEventBusForStepFunc", "default");

    // スケジュール: StepFunctions を起動
    new aws_events.CfnRule(stack, "StepFunctionTriggerRule", {
        eventBusName: eventBusForStepFunc.eventBusName,
        name: process.env.RULE_NAME_IS_02 ?? `Is-triggerStepFunction-${BRANCH}`,
        scheduleExpression: "cron(0 10,11,12,13,14 * * ? *)",
        state: BRANCH === "main" ? "ENABLED" : "DISABLED",
        targets: [
            {
                id: "TriggerStepFunctionTarget",
                arn: stateMachine.stateMachineArn,
                roleArn: eventBusForStepFuncRole.roleArn,
            },
        ],
    });

    return { eventBusForStepFunc };
}
