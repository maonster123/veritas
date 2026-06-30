import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OutlineApp from "@/components/OutlineApp";
import CreateProjectForm from "@/components/CreateProjectForm";
import LandingPage from "@/components/LandingPage";
import ProjectDashboard from "@/components/ProjectDashboard";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return <LandingPage />;
  }

  const { projectId } = await searchParams;

  // Direct project link (from archive)
  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (project && project.userId === session.user.id) {
      return <OutlineApp projectId={project.id} title={project.title} subtitle={project.subtitle} keywords={project.keywords} titlePage={project.titlePage} lang={project.lang} />;
    }
  }

  // Check for existing projects
  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  // Always show dashboard with existing projects + new project option
  return <ProjectDashboard projects={projects} />;
}
