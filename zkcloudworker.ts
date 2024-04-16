import { Handler, Context, Callback } from "aws-lambda";
import { verifyJWT } from "./src/api/jwt";
import { Sequencer } from "./src/api/sequencer";
import { Jobs } from "./src/table/jobs";
import { deploy } from "./src/api/deploy";
import { execute, createExecuteJob } from "./src/api/execute";
import { createRecursiveProofJob } from "./src/api/recursive";

const ZKCLOUDWORKER_AUTH = process.env.ZKCLOUDWORKER_AUTH!;

const api: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  try {
    //console.log("event", event.body);
    const body = JSON.parse(event.body);
    if (
      body &&
      body.auth &&
      body.auth === ZKCLOUDWORKER_AUTH &&
      body.command &&
      body.data &&
      body.jwtToken &&
      body.chain
    ) {
      const { command, data, jwtToken, chain, webhook } = body;
      const id: string | undefined = verifyJWT(body.jwtToken);
      if (id === undefined) {
        console.error("Wrong jwtToken");
        callback(null, {
          statusCode: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true,
          },
          body: "Wrong jwtToken",
        });
        return;
      }
      switch (command) {
        case "getBalance":
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify("1", null, 2), // TODO: get actual balance
          });
          return;

        case "queryBilling":
          const jobsTable = new Jobs(process.env.JOBS_TABLE!);
          const billingResult = await jobsTable.queryBilling(id);
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body:
              billingResult === undefined
                ? "error"
                : JSON.stringify(billingResult, null, 2) ?? "error",
          });
          return;
          break;

        case "deploy": {
          const result = await createExecuteJob({
            command: "deploy",
            data,
          });
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify(result, null, 2),
          });
          return;
        }

        case "recursiveProof": {
          const result = await createRecursiveProofJob(data);
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify(result, null, 2),
          });
          return;
        }

        case "execute": {
          const result = await createExecuteJob({
            command: "execute",
            data,
          });
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify(result, null, 2),
          });
          return;
        }

        case "jobResult": {
          if (body.data.jobId === undefined) {
            console.error("No jobId");
            callback(null, {
              statusCode: 200,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
              },
              body: "No jobId",
            });
            return;
          }
          const sequencer = new Sequencer({
            jobsTable: process.env.JOBS_TABLE!,
            stepsTable: process.env.STEPS_TABLE!,
            proofsTable: process.env.PROOFS_TABLE!,
            id,
            jobId: body.data.jobId,
          });
          const jobResult = await sequencer.getJobStatus();
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify(jobResult, null, 2) ?? "error",
          });
          return;
        }

        default:
          console.error("Wrong command");
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body: "Wrong command",
          });
      }

      // await sleep(1000);
    }

    callback(null, {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: "ok",
    });
  } catch (error: any) {
    console.error("bot api catch", error.toString());
    callback(null, {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: "error",
    });
  }
};

const worker: Handler = async (event: any, context: Context) => {
  let success = false;
  const JobsTable = new Jobs(process.env.JOBS_TABLE!);
  const { command, id, jobId, developer, repo } = event;
  try {
    console.log("worker", event);
    if (command && id && jobId && developer && repo) {
      switch (event.command) {
        case "deploy":
          {
            success = await deploy({
              developer,
              repo,
              id,
              jobId,
            });
            success = true;
          }
          break;

        case "execute":
          {
            success = await execute({
              command,
              developer,
              repo,
              id,
              jobId,
            });
          }
          break;

        case "task":
          {
            success = await execute({
              command,
              developer,
              repo,
              id,
              jobId,
            });
          }
          break;

        default:
          console.error("worker: unknown command");
      }

      if (success === false) {
        console.error("worker: failed");

        await JobsTable.updateStatus({
          id: event.id,
          jobId: event.jobId,
          status: "failed",
          result: "worker: failed",
          billedDuration: 0,
        });
      }
    } else console.error("worker: Wrong event format");

    return {
      statusCode: 200,
      body: "ok",
    };
  } catch (error) {
    console.error("worker: catch", (<any>error).toString());
    await JobsTable.updateStatus({
      id: event.id,
      jobId: event.jobId,
      status: "failed",
      result: "worker: catch error",
      billedDuration: 0,
    });
    return {
      statusCode: 200,
      body: "worker run error",
    };
  }
};

export { worker, api };
