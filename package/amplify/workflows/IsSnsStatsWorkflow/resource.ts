import { Duration, Stack } from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { IFunction } from "aws-cdk-lib/aws-lambda";
type ScheduledFunctions = {
  IsSnsFunctionInstance: IFunction;
};
export function createSnsStatsWorkflow(scope: Stack, lambdaFn: ScheduledFunctions, env: "sandbox" | "develop" | "main" = "sandbox") {
  const { IsSnsFunctionInstance } = lambdaFn;
  new events.Rule(scope, "IsSocialCheck", {
    schedule: events.Schedule.cron({
      minute: "0",
      hour: "9",
      day: "*",
      month: "*",
      year: "*",
    }),
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
