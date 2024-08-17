import { RateLimiterMemory } from "rate-limiter-flexible";
import { BLOCKED_IPS, BLOCKED_DURATION } from "./blocked-ip";

const limiters: { [key: string]: RateLimiterMemory } = {};

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

  console.log(`Rate limit initialized for ${name}`);
  limiters[name] = rateLimiter;
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
