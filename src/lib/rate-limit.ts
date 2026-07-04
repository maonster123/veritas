import { prisma } from "@/lib/prisma";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Check if a user has exceeded the rate limit for an action.
 * Uses a sliding window: counts all requests in the last `windowMinutes`.
 */
export async function checkRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowMinutes: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

  // Count recent requests
  const count = await prisma.rateLimit.count({
    where: {
      userId,
      action,
      createdAt: { gte: windowStart },
    },
  });

  const remaining = Math.max(0, limit - count - 1); // -1 because we haven't inserted yet
  const allowed = count < limit;

  // Reset time: windowStart + windowMinutes
  const resetAt = new Date(windowStart.getTime() + windowMinutes * 60 * 1000);

  return { allowed, remaining, resetAt };
}

/**
 * Record a rate limit hit for a user action.
 * Call this AFTER checkRateLimit passes.
 */
export async function recordRateLimit(userId: string, action: string): Promise<void> {
  await prisma.rateLimit.create({
    data: { userId, action },
  });
}

/**
 * Clean up old rate limit records (keep last 1 hour).
 * Call periodically or on each check to prevent unbounded growth.
 */
export async function cleanupRateLimits(): Promise<void> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  await prisma.rateLimit.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
}
