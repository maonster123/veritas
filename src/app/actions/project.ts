"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createProject(
  lang: string = "zh",
  citationStyleId: string = "c-gb7714"
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "请先登录" };

  const title = lang === "en" ? "Untitled Thesis" : "未命名论文";

  const project = await prisma.project.create({
    data: {
      title,
      userId: session.user.id,
      lang,
    },
  });

  // Activate the chosen citation style
  await prisma.projectCitationStyle.create({
    data: {
      projectId: project.id,
      citationStyleId,
      isActive: true,
    },
  });

  revalidatePath("/", "layout");
  redirect(`/?projectId=${project.id}`);
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

export async function listProjects(): Promise<{ success: boolean; projects?: { id: string; title: string; subtitle: string | null; lang: string; updatedAt: Date }[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "请先登录" };
    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, subtitle: true, lang: true, updatedAt: true },
    });
    return { success: true, projects };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "加载失败" };
  }
}

export async function deleteProject(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "请先登录" };

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });
    if (!project || project.userId !== session.user.id) return { success: false, error: "无权操作" };

    // Clean up related data
    await prisma.chatMessage.deleteMany({ where: { node: { projectId } } });
    await prisma.outlineReference.deleteMany({ where: { outlineNode: { projectId } } });
    await prisma.outlineNode.deleteMany({ where: { projectId } });
    await prisma.reference.deleteMany({ where: { projectId } });
    await prisma.projectCitationStyle.deleteMany({ where: { projectId } });
    await prisma.formatRule.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "删除失败" };
  }
}

export async function updateProject(
  projectId: string,
  data: { title?: string; subtitle?: string; keywords?: string | null; titlePage?: string | null }
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
