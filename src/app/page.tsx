import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OutlineApp from "@/components/OutlineApp";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
            论文大纲管理系统
          </h1>
          <p className="text-zinc-500 text-sm">请先登录以继续</p>
          <Link
            href="/auth/login"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  // Find the user's first project, or create one
  let project = await prisma.project.findFirst({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        title: "未命名论文",
        userId: session.user.id,
      },
    });
  }

  // Check if user has DeepSeek API key
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { deepseekApiKey: true },
  });
  const hasApiKey = !!user?.deepseekApiKey;

  return <OutlineApp projectId={project.id} title={project.title} subtitle={project.subtitle} hasApiKey={hasApiKey} />;
}
