import { Duration, Stack } from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import { IFunction } from "aws-cdk-lib/aws-lambda";

type ScheduledFunctions = {
    IsCreateFileInstance: IFunction;
};

/**
 * ファイル生成ワークフロー（Step Functions）を構築する。
 *
 * 全体の流れ:
 *   Step1: 日次の投稿ファイル / SNS ファイルを並列生成して S3 に配置  ※ 週次のみ
 *   Step2: ナレッジベース(KB)の同期(Ingestion)を開始               ※ 週次のみ
 *   Step3: 同期完了を確認(未完了なら 60 秒待機して再確認)           ※ 週次のみ
 *   Step4: 記事を生成                                              ※ 週次・月次
 *
 * EventBridge の週次・月次ルールから起動され、入力で executionType を受け取る。
 *
 * @param scope     CDK スタック
 * @param lambdaFn  スケジュール実行用 Lambda 群
 * @param env       デプロイ環境。"main" のときのみスケジュールが有効化される
 */
export function createFileWorkflow(scope: Stack, lambdaFn: ScheduledFunctions, env: "sandbox" | "main" = "sandbox") {
    const { IsCreateFileInstance } = lambdaFn;

    // ------------------------------------------------------------
    // Step4: 記事生成（週次・月次共通）
    // 週次: KB 同期の完了後 / 月次: 開始直後に実行する。
    // ------------------------------------------------------------
    const generateArticle = new tasks.LambdaInvoke(scope, "GenerateWeeklyArticle", {
        lambdaFunction: IsCreateFileInstance,
        payload: sfn.TaskInput.fromObject({
            procType: "generateWeeklyArticle",
            executionType: sfn.JsonPath.stringAt("$$.Execution.Input.executionType")
        }),
        resultPath: sfn.JsonPath.DISCARD,
    });

    // ------------------------------------------------------------
    // 同期完了 → ファイル生成へ合流するための Pass ステート
    // 初回チェックとループ内チェックの両方からここに集約する。
    // ------------------------------------------------------------
    const ingestionComplete = new sfn.Pass(scope, "IngestionComplete");
    ingestionComplete.next(generateArticle);

    // ------------------------------------------------------------
    // 同期完了待ちループ（Wait → 再チェック → 分岐）
    // 同じステート名は 1 つの定義内で二重に使えないため、
    // 初回チェックとは別インスタンスとして作成している。
    // ------------------------------------------------------------
    const checkIngestionLoop = new tasks.LambdaInvoke(scope, "CheckIngestionLoop", {
        lambdaFunction: IsCreateFileInstance,
        payload: sfn.TaskInput.fromObject({
            procType: "checkIngestion",
            // Step1 で取得した ingestionJobId をステート入力から引き継ぐ
            "ingestionJobId.$": "$.ingestion.ingestionJobId",
        }),
        // Lambda の戻り値から done フラグだけを抽出して保存
        resultSelector: { "done.$": "$.Payload.done" },
        resultPath: "$.ingestionCheck",
    });

    // 未完了時は 60 秒待ってから再チェック
    const waitForIngestion = new sfn.Wait(scope, "WaitForIngestion", {
        time: sfn.WaitTime.duration(Duration.seconds(60)),
    });
    waitForIngestion.next(checkIngestionLoop);

    // ループ内の分岐: 完了なら次へ、未完了なら再び待機
    const ingestionDoneLoop = new sfn.Choice(scope, "IngestionDoneLoop")
        .when(sfn.Condition.booleanEquals("$.ingestionCheck.done", true), ingestionComplete)
        .otherwise(waitForIngestion);
    checkIngestionLoop.next(ingestionDoneLoop);

    // ------------------------------------------------------------
    // Step3: 初回チェック
    // 同期開始直後に 1 回だけ完了確認を行い、
    // 完了済みならそのまま Step4 へ、未完了ならループへ入る。
    // ------------------------------------------------------------
    const checkIngestion = new tasks.LambdaInvoke(scope, "CheckIngestion", {
        lambdaFunction: IsCreateFileInstance,
        payload: sfn.TaskInput.fromObject({
            procType: "checkIngestion",
            ingestionJobId: sfn.JsonPath.stringAt("$.ingestion.ingestionJobId"),
        }),
        resultSelector: { "done.$": "$.Payload.done" },
        resultPath: "$.ingestionCheck",
    });
    const ingestionDone = new sfn.Choice(scope, "IngestionDone")
        .when(sfn.Condition.booleanEquals("$.ingestionCheck.done", true), ingestionComplete)
        .otherwise(waitForIngestion);
    checkIngestion.next(ingestionDone);

    // ------------------------------------------------------------
    // Step2: 同期開始
    // ingestionJobId を $.ingestion に格納する。
    // resultPath を使っているため、元の入力（executionType など）は保持される。
    // ------------------------------------------------------------
    const startIngestion = new tasks.LambdaInvoke(scope, "StartIngestion", {
        lambdaFunction: IsCreateFileInstance,
        payload: sfn.TaskInput.fromObject({ procType: "startIngestion" }),
        resultSelector: { "ingestionJobId.$": "$.Payload.ingestionJobId" },
        resultPath: "$.ingestion",
    });
    startIngestion.next(checkIngestion);

    // ------------------------------------------------------------
    // Step1: ファイル生成（並列）
    // 投稿ファイルと SNS ファイルを同時に生成する。
    // ------------------------------------------------------------
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
    const parallelCreate = new sfn.Parallel(scope, "ParallelCreate", {
        resultPath: sfn.JsonPath.DISCARD,
    })
        .branch(createPostFile)
        .branch(createSnsFile);
    parallelCreate.next(startIngestion);

    // 先頭の分岐
    const branchAtStart = new sfn.Choice(scope, "IsWeekly")
        .when(
            sfn.Condition.stringEquals("$$.Execution.Input.executionType", "weekly"),
            parallelCreate,
        )
        .otherwise(generateArticle);

    // 起点を Choice にする
    const definition = branchAtStart;

    const stateMachine = new sfn.StateMachine(scope, "IsCreateFileStateMachine", {
        definitionBody: sfn.DefinitionBody.fromChainable(definition),
        // 同期待ちが長引いた場合の暴走防止（最大 2 時間）
        timeout: Duration.hours(2),
    });

    // ------------------------------------------------------------
    // スケジュール設定
    // ※ cron は UTC 評価（hour: "0" は JST 9:00）
    // ※ main 環境以外ではルールを無効化して意図しない実行を防ぐ
    // ------------------------------------------------------------

    // 週次実行: 毎週日曜 00:00 UTC
    new events.Rule(scope, "IsCreateFileWeeklySchedule", {
        schedule: events.Schedule.cron({ minute: "0", hour: "0", weekDay: "SUN" }),
        targets: [
            new targets.SfnStateMachine(stateMachine, {
                input: events.RuleTargetInput.fromObject({
                    executionType: "weekly",
                }),
            }),
        ],
        enabled: env === "main",
    });

    // 月次実行: 第1日曜
    new events.Rule(scope, "IsCreateFileMonthlySchedule", {
        schedule: events.Schedule.cron({
            minute: "0",
            hour: "6",          // 週次より後の時刻にする
            weekDay: "SUN#1",   // 第1日曜
        }),
        targets: [
            new targets.SfnStateMachine(stateMachine, {
                input: events.RuleTargetInput.fromObject({
                    executionType: "monthly",
                }),
            }),
        ],
        enabled: env === "main",
    });
}
