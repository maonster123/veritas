"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function verifyProjectOwnership(projectId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { userId: true } });
  if (!project) return false;
  return project.userId === session.user.id;
}

async function verifyNodeOwnership(nodeId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const node = await prisma.outlineNode.findUnique({ where: { id: nodeId }, select: { project: { select: { userId: true } } } });
  if (!node) return false;
  return node.project.userId === session.user.id;
}

// ── Queries ──

export async function getOutlineTree(projectId: string) {
  if (!(await verifyProjectOwnership(projectId))) {
    throw new Error("Unauthorized");
  }
  const nodes = await prisma.outlineNode.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
    include: {
      outlineReferences: {
        include: { reference: { select: { id: true, title: true, year: true, authors: true, journal: true, volume: true, issue: true, pages: true } } },
      },
    },
  });
  return nodes;
}

// ── Mutations ──

export async function addNode(
  projectId: string,
  parentId: string | null,
  title: string,
  type: "chapter" | "section" | "subsection" | "paragraph",
  sortOrder: number
) {
  if (!(await verifyProjectOwnership(projectId))) {
    throw new Error("Unauthorized");
  }
  const node = await prisma.outlineNode.create({
    data: { projectId, parentId, title, type, sortOrder },
  });
  revalidatePath("/");
  return node;
}

export async function updateNode(
  nodeId: string,
  data: { title?: string; content?: string; notes?: string; type?: string }
) {
  if (!(await verifyNodeOwnership(nodeId))) {
    throw new Error("Unauthorized");
  }
  await prisma.outlineNode.update({ where: { id: nodeId }, data: data as any });
  revalidatePath("/");
}

export async function deleteNode(nodeId: string) {
  if (!(await verifyNodeOwnership(nodeId))) {
    throw new Error("Unauthorized");
  }
  // Recursively delete children first
  const children = await prisma.outlineNode.findMany({ where: { parentId: nodeId } });
  for (const child of children) {
    await deleteNode(child.id);
  }
  await prisma.outlineReference.deleteMany({ where: { outlineNodeId: nodeId } });
  await prisma.outlineNode.delete({ where: { id: nodeId } });
  revalidatePath("/");
}

export async function moveNode(nodeId: string, newParentId: string | null, newSortOrder: number) {
  if (!(await verifyNodeOwnership(nodeId))) {
    throw new Error("Unauthorized");
  }
  await prisma.outlineNode.update({
    where: { id: nodeId },
    data: { parentId: newParentId, sortOrder: newSortOrder },
  });
  revalidatePath("/");
}

export async function unlinkReference(outlineReferenceId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const or = await prisma.outlineReference.findUnique({
    where: { id: outlineReferenceId },
    include: { outlineNode: { select: { project: { select: { userId: true } } } } },
  });
  if (!or || or.outlineNode.project.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  await prisma.outlineReference.delete({ where: { id: outlineReferenceId } });
  revalidatePath("/");
}

export async function linkReference(nodeId: string, referenceId: string) {
  if (!(await verifyNodeOwnership(nodeId))) throw new Error("Unauthorized");

  await prisma.outlineReference.create({
    data: { outlineNodeId: nodeId, referenceId },
  });
  revalidatePath("/");
}
