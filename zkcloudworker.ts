import { Handler, Context, Callback } from "aws-lambda";
import { verifyJWT } from "./src/api/jwt";
import Sequencer from "./src/api/sequencer";
import JobsTable from "./src/table/jobs";
import Jobs from "./src/table/jobs";
import callLambda from "./src/lambda/lambda";
import {
  zkCloudWorkerDeploy,
  zkCloudWorkerRunJestOracle,
} from "./src/api/zkcloudworker";
import { isWorkerExist, getWorker } from "./src/api/worker";
import { S3File } from "./src/storage/s3";

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
      body.jwtToken
    ) {
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
      switch (body.command) {
        case "queryBilling":
          const jobsTable = new JobsTable(process.env.JOBS_TABLE!);
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

        case "deploy":
          {
            if (body.data.packageName === undefined) {
              console.error("Wrong deploy command", body.data);
              callback(null, {
                statusCode: 200,
                headers: {
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Credentials": true,
                },
                body: "Wrong deploy command",
              });
              return;
            }
            const { packageName } = body.data;

            const jobId = await createJob({
              command: "deploy",
              id,
              developer: "@dfst",
              repo: packageName,
              task: "deploy",
              args: "",
              jobsTable: process.env.JOBS_TABLE!,
            });
            callback(null, {
              statusCode: 200,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
              },
              body: jobId ?? "error",
            });
            return;
          }
          break;

        case "recursiveProof":
          {
            const { transactions, developer, repo, task, args, metadata } =
              body.data;
            if (
              transactions === undefined ||
              developer === undefined ||
              repo === undefined ||
              (await isWorkerExist({
                developer,
                repo,
              })) === false
            ) {
              console.error("Wrong recursiveProof command", body.data);
              callback(null, {
                statusCode: 200,
                headers: {
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Credentials": true,
                },
                body: "Wrong recursiveProof command",
              });
              return;
            }

            const filename =
              developer +
              "/" +
              "recursiveProof." +
              Date.now().toString() +
              ".json";
            const file = new S3File(process.env.BUCKET!, filename);
            await file.put(
              JSON.stringify({ transactions }),
              "application/json"
            );
            const sequencer = new Sequencer({
              jobsTable: process.env.JOBS_TABLE!,
              stepsTable: process.env.STEPS_TABLE!,
              proofsTable: process.env.PROOFS_TABLE!,
              id,
            });
            const jobId = await sequencer.createJob({
              id,
              developer,
              repo,
              filename,
              task: task ?? "recursiveProof",
              args: args,
              txNumber: transactions.length,
              metadata: metadata ?? "",
            });
            callback(null, {
              statusCode: 200,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
              },
              body: jobId ?? "error",
            });
            return;
          }
          break;

        case "execute":
          {
            const { developer, repo, task, args, metadata } = body.data;
            if (
              developer === undefined ||
              repo === undefined ||
              (await isWorkerExist({
                developer,
                repo,
              })) === false
            ) {
              console.error("Wrong execute command", body.data);
              callback(null, {
                statusCode: 200,
                headers: {
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Credentials": true,
                },
                body: "Wrong execute command",
              });
              return;
            }

            const jobId = await createJob({
              command: "execute",
              id,
              developer,
              repo,
              task,
              args,
              metadata,
              jobsTable: process.env.JOBS_TABLE!,
            });
            callback(null, {
              statusCode: 200,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
              },
              body: jobId ?? "error",
            });
            return;
          }
          break;

        case "jobResult":
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
          const sequencerResultTree = new Sequencer({
            jobsTable: process.env.JOBS_TABLE!,
            stepsTable: process.env.STEPS_TABLE!,
            proofsTable: process.env.PROOFS_TABLE!,
            id,
            jobId: body.data.jobId,
          });
          const jobResultTree = await sequencerResultTree.getJobStatus();
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify(jobResultTree, null, 2) ?? "error",
          });
          return;
          break;

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
  try {
    console.log("worker", event);
    if (event.id && event.jobId && event.command && event.name) {
      if (event.command === "deploy") {
        await zkCloudWorkerDeploy({
          name: event.name,
          id: event.id,
          jobId: event.jobId,
        });
        success = true;
      } else console.error("worker: unknown command");
      if (success === false) {
        console.error("worker: failed");
        const JobsTable = new Jobs(process.env.JOBS_TABLE!);
        await JobsTable.updateStatus({
          id: event.id,
          jobId: event.jobId,
          status: "failed",
          result: "worker: unknown command",
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
    return {
      statusCode: 200,
      body: "worker run error",
    };
  }
};

async function createJob(params: {
  command: string;
  id: string;
  developer: string;
  repo: string;
  task: string;
  args: string;
  jobsTable: string;
  metadata?: string;
}): Promise<string | undefined> {
  const { command, id, developer, repo, task, args, jobsTable, metadata } =
    params;
  const JobsTable = new Jobs(jobsTable);
  const jobId = await JobsTable.createJob({
    id,
    developer,
    repo,
    task,
    args,
    txNumber: 1,
    metadata,
  });
  await callLambda("worker", JSON.stringify({ command, id, jobId, name }));
  return jobId;
}

export { worker, api };
