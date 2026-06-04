"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createProject(
  lang: string = "zh"
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "请先登录" };

    const title = lang === "en" ? "Untitled Thesis" : "未命名论文";

    const project = await prisma.project.create({
      data: {
        title,
        userId: session.user.id,
        lang,
      },
    });

    revalidatePath("/");
    return { success: true, projectId: project.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "创建失败" };
  }
}

export async function updateProjectLang(
  projectId: string,
  lang: string
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

  await prisma.project.update({ where: { id: projectId }, data: { lang } });
  revalidatePath("/");
  return { success: true };
}

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
