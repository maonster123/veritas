"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLAN_CONFIG } from "@/lib/subscription";

export async function createOrder(
  plan: string
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "请先登录" };

    const planType = plan.toUpperCase();
    const config = PLAN_CONFIG[planType as keyof typeof PLAN_CONFIG];
    if (!config) return { success: false, error: "无效的套餐" };

    // Check if user already has a subscription
    const existing = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    // Calculate amount
    const amounts: Record<string, number> = {
      ONETIME: 9.9, MONTHLY: 19.9, YEARLY: 69,
    };
    const amount = amounts[planType] || 0;

    // Create or update subscription
    let subscription;
    if (existing) {
      subscription = await prisma.subscription.update({
        where: { userId: session.user.id },
        data: { plan: planType as any },
      });
    } else {
      subscription = await prisma.subscription.create({
        data: {
          userId: session.user.id,
          plan: planType as any,
          aiLimit: config.aiLimit,
          projectLimit: config.projectLimit,
        },
      });
    }

    // Create payment order
    const order = await prisma.paymentOrder.create({
      data: {
        subscriptionId: subscription.id,
        plan: planType as any,
        amount,
        provider: "wechat",
        status: "pending",
      },
    });

    return { success: true, orderId: order.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "创建订单失败" };
  }
}

export async function getSubscriptionStatus(
): Promise<{ success: boolean; plan?: string; aiRemaining?: number; expiresAt?: string; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "请先登录" };

    const sub = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!sub) return { success: true, plan: "free" };

    const config = PLAN_CONFIG[sub.plan as keyof typeof PLAN_CONFIG];
    return {
      success: true,
      plan: sub.plan.toLowerCase(),
      aiRemaining: sub.plan === "YEARLY" ? 999999 : Math.max(0, (config?.aiLimit || 0) - sub.aiUsed),
      expiresAt: sub.expiresAt?.toISOString() || undefined,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "查询失败" };
  }
}
