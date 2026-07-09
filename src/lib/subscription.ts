import { prisma } from "@/lib/prisma";

export const PLAN_CONFIG = {
  ONETIME: { aiLimit: 50, projectLimit: 1, name: "单次体验" },
  MONTHLY: { aiLimit: 200, projectLimit: 5, name: "包月" },
  YEARLY: { aiLimit: 999999, projectLimit: 999999, name: "包年" },
};

export async function getUserSubscription(userId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return null;

  // Check if expired
  if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) {
    return null;
  }

  return sub;
}

export async function checkAILimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const sub = await getUserSubscription(userId);

  if (!sub) {
    // Free user: 3 AI calls per hour (handled by existing rate limiter)
    return { allowed: true, remaining: 0 };
  }

  const config = PLAN_CONFIG[sub.plan as keyof typeof PLAN_CONFIG];
  if (!config) return { allowed: false, remaining: 0 };

  // YEARLY: unlimited
  if (sub.plan === "YEARLY") return { allowed: true, remaining: 999999 };

  const remaining = config.aiLimit - sub.aiUsed;
  return { allowed: remaining > 0, remaining: Math.max(0, remaining) };
}

export async function incrementAIUsage(userId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub || sub.plan === "YEARLY") return;

  await prisma.subscription.update({
    where: { userId },
    data: { aiUsed: { increment: 1 } },
  });
}
