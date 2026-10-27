import { Duration, Stack } from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import { IFunction } from "aws-cdk-lib/aws-lambda";

type ScheduledFunctions = {
    IsCreateFileInstance: IFunction;
};

export function createFileWorkflow(scope: Stack, lambdaFn: ScheduledFunctions, env: "sandbox" | "develop" | "main" = "sandbox") {
    const { IsCreateFileInstance } = lambdaFn;

    // Step3: ファイル生成（並列）
    const createPostFile = new tasks.LambdaInvoke(scope, "CreateDailyPostFile", {
        lambdaFunction: IsCreateFileInstance,
        payload: sfn.TaskInput.fromObject({ procType: "createDailyPostFile" }),
        resultPath: sfn.JsonPath.DISCARD,
    });
    const createSnsFile = new tasks.LambdaInvoke(scope, "CreateDailySnsFile", {
        lambdaFunction: IsCreateFileInstance,
        payload: sfn.TaskInput.fromObject({ procType: "createDailySnsFile" }),
        resultPath: sfn.JsonPath.DISCARD,
    });
    const parallelCreate = new sfn.Parallel(scope, "ParallelCreate")
        .branch(createPostFile)
        .branch(createSnsFile);

    // Step4: 週次記事生成
    const generateArticle = new tasks.LambdaInvoke(scope, "GenerateWeeklyArticle", {
        lambdaFunction: IsCreateFileInstance,
        payload: sfn.TaskInput.fromObject({ procType: "generateWeeklyArticle" }),
        resultPath: sfn.JsonPath.DISCARD,
    });
    parallelCreate.next(generateArticle);

    // IngestionComplete → parallelCreate
    const ingestionComplete = new sfn.Pass(scope, "IngestionComplete");
    ingestionComplete.next(parallelCreate);

    // ループ用: Wait後のチェック（初回チェックとは別インスタンス）
    const checkIngestionLoop = new tasks.LambdaInvoke(scope, "CheckIngestionLoop", {
        lambdaFunction: IsCreateFileInstance,
        payload: sfn.TaskInput.fromObject({
            procType: "checkIngestion",
            "ingestionJobId.$": "$.ingestion.ingestionJobId",
        }),
        resultSelector: { "done.$": "$.Payload.done" },
        resultPath: "$.ingestionCheck",
    });

    const waitForIngestion = new sfn.Wait(scope, "WaitForIngestion", {
        time: sfn.WaitTime.duration(Duration.seconds(60)),
    });
    waitForIngestion.next(checkIngestionLoop);

    // ループ用チェックの分岐
    const ingestionDoneLoop = new sfn.Choice(scope, "IngestionDoneLoop")
        .when(sfn.Condition.booleanEquals("$.ingestionCheck.done", true), ingestionComplete)
        .otherwise(waitForIngestion);
    checkIngestionLoop.next(ingestionDoneLoop);

    // Step2: 初回チェック
    const checkIngestion = new tasks.LambdaInvoke(scope, "CheckIngestion", {
        lambdaFunction: IsCreateFileInstance,
        payload: sfn.TaskInput.fromObject({
            procType: "checkIngestion",
            "ingestionJobId.$": "$.ingestion.ingestionJobId",
        }),
        resultSelector: { "done.$": "$.Payload.done" },
        resultPath: "$.ingestionCheck",
    });
    const ingestionDone = new sfn.Choice(scope, "IngestionDone")
        .when(sfn.Condition.booleanEquals("$.ingestionCheck.done", true), ingestionComplete)
        .otherwise(waitForIngestion);
    checkIngestion.next(ingestionDone);

    // Step1: 同期開始
    const startIngestion = new tasks.LambdaInvoke(scope, "StartIngestion", {
        lambdaFunction: IsCreateFileInstance,
        payload: sfn.TaskInput.fromObject({ procType: "startIngestion" }),
        resultSelector: { "ingestionJobId.$": "$.Payload.ingestionJobId" },
        resultPath: "$.ingestion",
    });

    const definition = startIngestion
        .next(checkIngestion);

    const stateMachine = new sfn.StateMachine(scope, "IsCreateFileStateMachine", {
        definitionBody: sfn.DefinitionBody.fromChainable(definition),
        timeout: Duration.hours(2),
    });

    new events.Rule(scope, "IsCreateFileSchedule", {
        schedule: events.Schedule.cron({ minute: "0", hour: "0", weekDay: "SUN" }),
        targets: [new targets.SfnStateMachine(stateMachine)],
        enabled: env === "main",
    });
}
