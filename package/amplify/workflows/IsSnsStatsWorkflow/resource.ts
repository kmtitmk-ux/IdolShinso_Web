import { Duration, Stack } from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { IFunction } from "aws-cdk-lib/aws-lambda";
type ScheduledFunctions = {
  IsSnsFunctionInstance: IFunction;
};
export function createSnsStatsWorkflow(scope: Stack, lambdaFn: ScheduledFunctions, env: "sandbox" | "develop" | "main" = "sandbox") {
  // 3日おきに直接Lambdaを起動する EventBridge ルール
  const { IsSnsFunctionInstance } = lambdaFn;
  new events.Rule(scope, "IsSocialCheck", {
    schedule: events.Schedule.rate(Duration.days(2)),
    targets: [
      new targets.LambdaFunction(IsSnsFunctionInstance, {
        event: events.RuleTargetInput.fromObject({
          procType: "threadsCheck"
        }),
      }),
      new targets.LambdaFunction(IsSnsFunctionInstance, {
        event: events.RuleTargetInput.fromObject({
          procType: "xCheck"
        }),
      })
    ],
    enabled: env === "main",
  });

}
