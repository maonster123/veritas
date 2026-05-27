"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ── Queries ──

export async function getOutlineTree(projectId: string) {
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
  await prisma.outlineNode.update({ where: { id: nodeId }, data: data as any });
  revalidatePath("/");
}

export async function deleteNode(nodeId: string) {
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
  await prisma.outlineNode.update({
    where: { id: nodeId },
    data: { parentId: newParentId, sortOrder: newSortOrder },
  });
  revalidatePath("/");
}
