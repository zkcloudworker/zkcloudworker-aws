import {
  LambdaClient,
  InvokeCommand,
  InvokeCommandInput,
  UpdateFunctionConfigurationCommand,
  UpdateFunctionConfigurationCommandInput,
} from "@aws-sdk/client-lambda";

export async function callLambda(
  name: string,
  payload: any,
  attempt: number = 0
) {
  // TODO: Check user balance before calling lambda
  try {
    //console.log("Lambda call:", name);
    if (attempt > 0) console.log("Attempt:", attempt);
    const client = new LambdaClient();

    const params: InvokeCommandInput = {
      FunctionName: "zkcloudworker-dev-" + name, // the lambda function we are going to invoke
      InvocationType: "Event",
      Payload: payload,
    } as InvokeCommandInput;
    const command = new InvokeCommand(params);
    const result = await client.send(command);
    //console.log("Lambda call result", result);
    console.log("Lambda call:", name, "id:", result.$metadata.requestId);
    if (
      result.FunctionError ||
      result.StatusCode !== 202 ||
      result.$metadata.requestId === undefined
    )
      console.error("Lambda call error:", result);
    if (attempt > 0) console.log("Lambda call result:", result);
    await sleep(500);
  } catch (error: any) {
    console.error("Error: Lambda call", error);
  }
}

export async function forceRestartLambda() {
  try {
    const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
    console.error("Lambda force restart:", functionName);
    const client = new LambdaClient();

    const params: InvokeCommandInput = {
      FunctionName: functionName,
      Description: `forced restart ${new Date().toLocaleString()}`,
    } as UpdateFunctionConfigurationCommandInput;
    const command = new UpdateFunctionConfigurationCommand(params);
    const result = await client.send(command);
    console.log("Lambda force restart call result", result.$metadata);
    await sleep(500);
  } catch (error: any) {
    console.error("Error: Lambda call", error);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
