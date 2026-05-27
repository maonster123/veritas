"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateProject(
  projectId: string,
  data: { title?: string; subtitle?: string }
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "请先登录" };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project || project.userId !== session.user.id) {
    return { success: false, error: "无权操作" };
  }

  await prisma.project.update({ where: { id: projectId }, data });
  revalidatePath("/");
  return { success: true };
}
