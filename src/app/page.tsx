import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OutlineApp from "@/components/OutlineApp";
import CreateProjectForm from "@/components/CreateProjectForm";
import LandingPage from "@/components/LandingPage";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    return <LandingPage />;
  }

  // Find the user's first project
  const project = await prisma.project.findFirst({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  // No project yet — show lang selector
  if (!project) {
    return <CreateProjectForm />;
  }

  // Check if user has DeepSeek API key
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { deepseekApiKey: true },
  });
  const hasApiKey = !!user?.deepseekApiKey;

  return <OutlineApp projectId={project.id} title={project.title} subtitle={project.subtitle} keywords={project.keywords} titlePage={project.titlePage} lang={project.lang} hasApiKey={hasApiKey} />;
}
