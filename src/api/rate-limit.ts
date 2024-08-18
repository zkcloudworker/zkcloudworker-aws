import { RateLimiterMemory, RateLimiterDynamo } from "rate-limiter-flexible";
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { BLOCKED_IPS, BLOCKED_DURATION } from "./blocked-ip";

const limiters: { [key: string]: RateLimiterMemory | RateLimiterDynamo } = {};

export function initializeRateLimiter(params: {
  name: string;
  points: number;
  duration: number;
}) {
  const { name, points, duration } = params;
  if (limiters[name]) return;
  const rateLimiter = new RateLimiterMemory({
    points,
    duration,
  });

  for (const ip of BLOCKED_IPS) {
    rateLimiter.block(ip, BLOCKED_DURATION);
  }

  limiters[name] = rateLimiter;
  console.log(`Rate limit initialized for ${name}`);
}

export async function initializeDynamoRateLimiter(params: {
  name: string;
  points: number;
  duration: number;
}) {
  const { name, points, duration } = params;
  const tableName = process.env.RATE_LIMIT_TABLE;
  if (!tableName) {
    console.error("RATE_LIMIT_TABLE not set");
    return;
  }
  if (limiters[name]) return;
  const dynamoClient = new DynamoDB({});
  const rateLimiter = new RateLimiterDynamo({
    storeClient: dynamoClient,
    dynamoTableOpts: {
      readCapacityUnits: 30, // default is 25
      writeCapacityUnits: 30, // default is 25
    },
    points,
    duration,
    tableCreated: true,
    tableName,
    keyPrefix: name,
  });
  limiters[name] = rateLimiter;
  console.log(`Dynamo Rate limit initialized for ${name}`);
}

const limited: { [key: string]: number } = {};

export async function rateLimit(params: {
  name: string;
  key: string;
}): Promise<boolean> {
  const { name, key } = params;
  try {
    const rateLimiter = limiters[name];
    if (!rateLimiter) {
      console.error(`Rate limiter ${name} not initialized`);
      return false;
    }

    await rateLimiter.consume(key);
    return false;
  } catch (error) {
    if (limited[key] === undefined || limited[key] < Date.now()) {
      limited[key] = Date.now() + 1000 * 60 * 60;
      if (name !== "getBlocksInfo")
        console.error(`Rate limit exceeded for ${name} : ${key}`);
      else console.log(`Rate limit exceeded for ${name} : ${key}`);
    }
    return true;
  }
}

export async function penalizeRateLimit(params: {
  name: string;
  key: string;
  points: number;
}): Promise<void> {
  const { name, key, points } = params;
  try {
    const rateLimiter = limiters[name];
    if (!rateLimiter) {
      console.error(`Rate limiter ${name} not initialized`);
      return;
    }
    console.error(
      `Penalizing rate limit for ${name} : ${key} (${points} points)`
    );

    await rateLimiter.penalty(key, points);
  } catch (error) {
    console.error("penalizeRateLimit error", params, error);
  }
}
