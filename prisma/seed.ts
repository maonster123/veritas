import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clean existing data (order matters for FK constraints)
  await prisma.outlineReference.deleteMany();
  await prisma.projectCitationStyle.deleteMany();
  await prisma.outlineNode.deleteMany();
  await prisma.reference.deleteMany();
  await prisma.formatRule.deleteMany();
  await prisma.citationStyle.deleteMany();
  await prisma.project.deleteMany();

  // Create citation styles
  const gbt = await prisma.citationStyle.create({
    data: {
      name: "GB/T 7714-2015",
      formatType: "numeric",
      template: JSON.stringify({
        book: "{authors}. {title}[M]. {address}: {publisher}, {year}.",
        article: "{authors}. {title}[J]. {journal}, {year}, {volume}({issue}): {pages}.",
      }),
    },
  });

  const apa = await prisma.citationStyle.create({
    data: {
      name: "APA 7th",
      formatType: "author_year",
      template: JSON.stringify({
        book: "{authors} ({year}). *{title}*. {publisher}.",
        article: "{authors} ({year}). {title}. *{journal}*, *{volume}*({issue}), {pages}.",
      }),
    },
  });

  const ieee = await prisma.citationStyle.create({
    data: {
      name: "IEEE",
      formatType: "numeric",
      template: JSON.stringify({
        article: "[{index}] {authors}, \"{title},\" *{journal}*, vol. {volume}, no. {issue}, pp. {pages}, {year}.",
      }),
    },
  });

  const mla = await prisma.citationStyle.create({
    data: {
      name: "MLA 9th",
      formatType: "author_page",
      template: JSON.stringify({
        book: "{authors}. *{title}*. {publisher}, {year}.",
        article: "{authors}. \"{title}.\" *{journal}*, vol. {volume}, no. {issue}, {year}, pp. {pages}.",
      }),
    },
  });

  console.log("Created citation styles:", gbt.name, apa.name, ieee.name, mla.name);

  // Create a project
  const project = await prisma.project.create({
    data: {
      title: "基于深度学习的自然语言处理研究",
      subtitle: "以机器翻译为例",
      status: "draft",
    },
  });
  console.log("Created project:", project.title);

  // Create format rule for the project
  await prisma.formatRule.create({
    data: {
      projectId: project.id,
      pageMargins: JSON.stringify({ top: 25, bottom: 25, left: 30, right: 25 }),
      lineSpacing: 1.5,
      headingStyles: JSON.stringify({
        level1: { font: "SimHei", size: 16, bold: true },
        level2: { font: "SimHei", size: 14, bold: true },
        level3: { font: "SimHei", size: 12, bold: true },
      }),
      bodyFont: JSON.stringify({ family: "SimSun", size: 12 }),
      headerFooter: JSON.stringify({ header: "硕士学位论文", footer: "{page}" }),
    },
  });

  // Activate GB/T 7714 for the project
  await prisma.projectCitationStyle.create({
    data: {
      projectId: project.id,
      citationStyleId: gbt.id,
      isActive: true,
    },
  });

  // Create outline tree
  const ch1 = await prisma.outlineNode.create({
    data: {
      projectId: project.id,
      title: "绪论",
      type: "chapter",
      sortOrder: 0,
    },
  });

  const ch1s1 = await prisma.outlineNode.create({
    data: {
      projectId: project.id,
      parentId: ch1.id,
      title: "研究背景与意义",
      type: "section",
      sortOrder: 0,
      content: "自然语言处理是人工智能领域的重要分支...",
    },
  });

  await prisma.outlineNode.create({
    data: {
      projectId: project.id,
      parentId: ch1.id,
      title: "国内外研究现状",
      type: "section",
      sortOrder: 1,
    },
  });

  const ch2 = await prisma.outlineNode.create({
    data: {
      projectId: project.id,
      title: "相关技术综述",
      type: "chapter",
      sortOrder: 1,
    },
  });

  await prisma.outlineNode.create({
    data: {
      projectId: project.id,
      parentId: ch2.id,
      title: "Transformer 架构",
      type: "section",
      sortOrder: 0,
    },
  });

  await prisma.outlineNode.create({
    data: {
      projectId: project.id,
      parentId: ch2.id,
      title: "注意力机制详解",
      type: "section",
      sortOrder: 1,
      content: "注意力机制的核心思想是...",
    },
  });

  console.log("Created outline tree with chapters and sections");

  // Create a reference
  const ref = await prisma.reference.create({
    data: {
      projectId: project.id,
      doi: "10.1038/nature14539",
      title: "Deep learning",
      authors: JSON.stringify([
        { given: "Yann", family: "LeCun", order: 0 },
        { given: "Yoshua", family: "Bengio", order: 1 },
        { given: "Geoffrey", family: "Hinton", order: 2 },
      ]),
      journal: "Nature",
      volume: "521",
      issue: "7553",
      pages: "436-444",
      year: 2015,
      publisher: "Nature Publishing Group",
      abstract: "Deep learning allows computational models...",
    },
  });
  console.log("Created reference:", ref.title);

  // Link reference to outline node
  await prisma.outlineReference.create({
    data: {
      outlineNodeId: ch1s1.id,
      referenceId: ref.id,
      citationText: "[1]",
    },
  });
  console.log("Linked reference to outline node");

  // Query verification: fetch project with full tree
  const fullProject = await prisma.project.findUnique({
    where: { id: project.id },
    include: {
      outlineNodes: {
        where: { parentId: null },
        include: {
          children: {
            include: { children: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      references: true,
      formatRule: true,
      citationStyles: { include: { citationStyle: true } },
    },
  });

  console.log("\n=== Full Project Query ===");
  console.log("Title:", fullProject?.title);
  console.log("Chapters:", fullProject?.outlineNodes.length);
  console.log("References:", fullProject?.references.length);
  console.log("Format rule:", fullProject?.formatRule ? "exists" : "missing");
  console.log("Active citation style:", fullProject?.citationStyles.find((cs) => cs.isActive)?.citationStyle.name);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("\nSeed completed successfully.");
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
