import { Handler, Context, Callback } from "aws-lambda";
import { verifyJWT, generateJWT } from "./src/api/jwt";
import { Sequencer } from "./src/api/sequencer";
import { Jobs } from "./src/table/jobs";
import { deploy } from "./src/api/deploy";
import { verify } from "./src/api/verify";
import { execute, createExecuteJob } from "./src/api/execute";
import { createRecursiveProofJob } from "./src/api/recursive";
import { CloudWorker } from "./src/api/cloud";
import { getPresignedUrl } from "./src/storage/presigned";
import { LogStream } from "./src/cloud";
import { createAccount, getBalance } from "./src/table/balance";
const MAX_JOB_AGE: number = 1000 * 60 * 60; // 60 minutes
const INITIAL_BALANCE: number = 10; // MINA
const nameContract = {
  // TODO: remove later
  contractAddress: "B62qoYeVkaeVimrjBNdBEKpQTDR1gVN2ooaarwXaJmuQ9t8MYu9mDNS",
};

const ZKCLOUDWORKER_AUTH = process.env.ZKCLOUDWORKER_AUTH!;

const api: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  try {
    console.log("api", event.body);
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
      const { command, data, chain } = body;
      const id: string | undefined = verifyJWT(body.jwtToken);
      if (id === undefined) {
        console.error("Wrong jwtToken");
        callback(null, {
          statusCode: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true,
          },
          body: "error: Wrong jwtToken",
        });
        return;
      }
      switch (command) {
        case "generateJWT":
          const jwt = generateJWT(data);
          if (jwt !== undefined)
            await createAccount({
              id: data.id,
              initialBalance: INITIAL_BALANCE,
            });
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body: jwt ?? "error",
          });
          return;

        case "getBalance":
          const balance = await getBalance(id);
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body: balance.toString(),
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
          const { developer, repo, args } = data;
          const result = await createExecuteJob({
            command: "deploy",
            data: {
              developer,
              repo,
              args,
              task: "deploy",
              chain,
              id,
              transactions: [],
            },
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

        case "verify": {
          const { developer, repo, args } = data;
          const result = await createExecuteJob({
            command: "verify",
            data: {
              developer,
              repo,
              args,
              task: "verify",
              chain,
              id,
              transactions: [],
            },
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
          const result = await createRecursiveProofJob({
            ...data,
            chain,
            id,
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

        case "execute": {
          if (
            data.developer === "@staketab" &&
            data.args &&
            JSON.parse(data.args).contractAddress !==
              nameContract.contractAddress
          ) {
            callback(null, {
              statusCode: 200,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
              },
              body: JSON.stringify(
                {
                  success: false,
                  error:
                    "Invalid contract address, should be " +
                    nameContract.contractAddress,
                },
                null,
                2
              ),
            });
            return;
          }
          const result = await createExecuteJob({
            command: "execute",
            data: { ...data, chain, id },
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

        case "sendTransactions": {
          const { developer, repo, transactions } = data;
          const result = await CloudWorker.addTransactions({
            id,
            developer,
            repo,
            transactions,
          });
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify(
              result === undefined ? { success: false } : result,
              null,
              2
            ),
          });
          return;
        }

        case "jobResult": {
          const { jobId, includeLogs } = data;
          if (jobId === undefined) {
            console.error("No jobId");
            callback(null, {
              statusCode: 200,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
              },
              body: "error: No jobId",
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
          const jobResult = await sequencer.getJobStatus(includeLogs ?? false);
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

        case "presignedUrl": {
          const { developer, repo, args: version } = data;
          if (
            developer === undefined ||
            repo === undefined ||
            version === undefined
          ) {
            console.error("No developer or repo or version");
            callback(null, {
              statusCode: 200,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
              },
              body: "error: No developer or repo or version",
            });
            return;
          }
          const url = await getPresignedUrl({ developer, repo, version });
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({ url }, null, 2) ?? "error",
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
            body: "error: wrong command",
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
    console.error("api catch", error.toString());
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
  const logStream: LogStream = {
    logGroupName: context.logGroupName,
    logStreamName: context.logStreamName,
    awsRequestId: context.awsRequestId,
  };
  const { command, id, jobId, developer, repo, args, chain } = event;
  try {
    console.log("worker", event);
    if (command && id && jobId && developer && repo) {
      const job = await JobsTable.get({
        id,
        jobId,
      });
      if (job === undefined) throw new Error("job not found");

      if (job.jobStatus === "failed") {
        console.log("worker: job is failed, exiting");
        return false;
      }
      if (job.jobStatus === "finished" || job.jobStatus === "used") {
        console.log("worker: job is finished or used, exiting");
        return false;
      }
      if (Date.now() - job.timeCreated > MAX_JOB_AGE) {
        console.error("worker: job is too old, exiting");
        return false;
      }
      if (job.jobStatus !== "created") {
        console.error("worker: job status is not created");
      }

      await JobsTable.updateStatus({
        id: event.id,
        jobId: event.jobId,
        status: "started",
        logStreams: [logStream],
      });

      switch (event.command) {
        case "deploy":
          {
            success = await deploy({
              developer,
              repo,
              id,
              jobId,
              args,
            });
            success = true;
          }
          break;

        case "verify":
          {
            success = await verify({
              developer,
              repo,
              id,
              jobId,
              args,
              chain,
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
              job,
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
              job,
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
      body: "error: worker run error",
    };
  }
};

export { worker, api };
