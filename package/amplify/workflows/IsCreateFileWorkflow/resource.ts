import { Duration, Stack } from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { IFunction } from "aws-cdk-lib/aws-lambda";
type ScheduledFunctions = {
  IsCreateFileInstance: IFunction;
};
export function createFileWorkflow(scope: Stack, lambdaFn: ScheduledFunctions, env: "sandbox" | "develop" | "main" = "sandbox") {
  // 7日おきに直接Lambdaを起動する EventBridge ルール
  const { IsCreateFileInstance } = lambdaFn;
  new events.Rule(scope, "IsCreateFil", {
    schedule: events.Schedule.rate(Duration.days(7)),
    targets: [
      new targets.LambdaFunction(IsCreateFileInstance, {
        event: events.RuleTargetInput.fromObject({
          procType: "createDailyFile"
        }),
      })
    ],
    enabled: env === "main",
  });

}
