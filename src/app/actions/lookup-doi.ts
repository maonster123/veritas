"use server";

import { auth } from "@/lib/auth";
import { resolveDOI } from "@/lib/doi-resolver";
import { prisma } from "@/lib/prisma";

export interface LookupResult {
  success: boolean;
  reference?: {
    id: string;
    title: string;
    authors: string;
    journal: string | null;
    year: number | null;
    doi: string | null;
  };
  error?: string;
}

export async function lookupAndSaveDOI(
  projectId: string,
  doi: string
): Promise<LookupResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "请先登录" };
    }
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { userId: true } });
    if (!project || project.userId !== session.user.id) {
      return { success: false, error: "无权操作该项目" };
    }

    // Check if DOI already exists in this project
    const existing = await prisma.reference.findUnique({
      where: { projectId_doi: { projectId, doi } },
    });
    if (existing) {
      return {
        success: false,
        error: "该 DOI 已存在于当前项目的文献库中",
      };
    }

    // Resolve DOI via CrossRef/DataCite
    const resolved = await resolveDOI(doi);

    // Save to database
    const reference = await prisma.reference.create({
      data: {
        projectId,
        doi,
        title: resolved.title,
        authors: JSON.stringify(resolved.authors),
        journal: resolved.journal,
        volume: resolved.volume,
        issue: resolved.issue,
        pages: resolved.pages,
        year: resolved.year,
        publisher: resolved.publisher,
        url: resolved.url,
        abstract: resolved.abstract,
        rawBibtex: resolved.rawBibtex,
      },
      select: {
        id: true,
        title: true,
        authors: true,
        journal: true,
        year: true,
        doi: true,
      },
    });

    return { success: true, reference };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}
