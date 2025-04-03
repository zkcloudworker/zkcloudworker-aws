import { Handler, Context, Callback } from "aws-lambda";
import { Sequencer } from "./src/api/sequencer";
import { Jobs } from "./src/table/jobs";
import {
  JobStatus,
  JobData,
  blockchain,
  makeString,
  sleep,
  formatTime,
  LogStream,
} from "./src/cloud";
import { getLogs } from "./src/api/logs";
import { Workers } from "./src/table/workers";
import { getBalance, getBalances } from "./src/table/balance";
import { rateLimit, initializeRateLimiter } from "./src/api/rate-limit";
import { Deployments } from "./src/table/deployments";
const DEPLOYMENTS_TABLE = process.env.DEPLOYMENTS_TABLE!;

initializeRateLimiter({
  name: "explorer",
  points: 360,
  duration: 60,
});

type Command =
  | "balance"
  | "balances"
  | "agent"
  | "agents"
  | "jobResult"
  | "queryBilling";

interface BalanceRequest {
  id: string;
}

interface JobResultRequest {
  id: string;
  jobId: string;
  includeLogs: boolean;
}

interface AgentRequest {
  developer: string;
  repo: string;
}

const EXPLORER_API_KEY = process.env.EXPLORER_API_KEY!;

const api: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  const ip = event?.requestContext?.identity?.sourceIp ?? "no-ip";
  try {
    const body = JSON.parse(event.body);
    if (body?.auth !== EXPLORER_API_KEY) {
      console.error("explorer: wrong api key", ip, event);
      callback(null, {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: "error: wrong api key",
      });
      return;
    }
    if (
      await rateLimit({
        name: "explorer",
        key: "explorer",
      })
    ) {
      console.error("explorer rate limit", ip);
      callback(null, {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: "error: rate limit exceeded",
      });
      return;
    }

    if (body && body.command) {
      const { command, data } = body;
      console.log("explorer: command", command, data);

      switch (command) {
        case "balance":
          if (!data) throw new Error("No data");
          const { id } = data as BalanceRequest;
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

        case "balances":
          const balances = await getBalances();
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({ balances }, null, 2),
          });
          return;

        case "queryBilling": {
          const jobsTable = new Jobs(process.env.JOBS_TABLE!);
          if (!data) throw new Error("No data");
          const { id } = data as BalanceRequest;
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
        }

        case "deployments": {
          const deploymentsTable = new Deployments(DEPLOYMENTS_TABLE);
          if (!data) throw new Error("No data");
          const { developer, repo } = data as AgentRequest;
          const deployments = await deploymentsTable.queryDeployments({
            developer,
            repo,
          });
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body:
              deployments === undefined
                ? "error"
                : JSON.stringify(deployments, null, 2) ?? "error",
          });
          return;
        }

        case "agent": {
          if (!data) throw new Error("No data");
          const { developer, repo } = data as AgentRequest;
          const workersTable = new Workers(process.env.WORKERS_TABLE!);
          const result = await workersTable.get({
            developer,
            repo,
          });
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body:
              result === undefined
                ? "error"
                : JSON.stringify(result, null, 2) ?? "error",
          });
          return;
        }

        case "agents": {
          const workersTable = new Workers(process.env.WORKERS_TABLE!);
          const agents = await workersTable.scan();
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({ agents }, null, 2),
          });
          return;
        }

        case "jobResult": {
          if (!data) throw new Error("No data");
          const { id, jobId, includeLogs } = data as JobResultRequest;
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
            jobId,
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

        case "job": {
          if (!data) throw new Error("No data");
          const { jobId, includeLogs } = data as JobResultRequest;
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
          console.log("jobId", jobId);
          const JobsTable = new Jobs(process.env.JOBS_TABLE!);
          const jobs: JobData[] = await JobsTable.queryData(
            "jobId = :id",
            {
              ":id": jobId,
            },
            "",
            "JobIdIndex"
          );
          console.log("jobs", jobs);
          if (jobs.length < 1) {
            console.error("No jobId");
            callback(null, {
              statusCode: 200,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
              },
              body: "error: No such job",
            });
            return;
          }
          const job = jobs[0];

          if (includeLogs) {
            const { logs, isFullLog } = await getLogs([
              ...(job.logStreams ?? []),
            ]);
            job.logs = logs;
            job.isFullLog = isFullLog;
          }
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify(job, null, 2) ?? "error",
          });
          return;
        }

        default:
          console.error("explorer: wrong command", body);
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body: "error: wrong command",
          });
          return;
      }
    }

    callback(null, {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: "error: wrong payload",
    });
  } catch (error: any) {
    console.error("explorer: catch", error.toString());
    callback(null, {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body:
        "error: " +
        (error?.message ? String(error.message) : "unknown error 27"),
    });
  }
};

export { api };
