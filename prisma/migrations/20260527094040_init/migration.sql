-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OutlineNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'chapter',
    "content" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OutlineNode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutlineNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OutlineNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "doi" TEXT,
    "title" TEXT NOT NULL,
    "authors" TEXT NOT NULL DEFAULT '[]',
    "journal" TEXT,
    "volume" TEXT,
    "issue" TEXT,
    "pages" TEXT,
    "year" INTEGER,
    "publisher" TEXT,
    "url" TEXT,
    "abstract" TEXT,
    "rawBibtex" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutlineReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outlineNodeId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "citationText" TEXT,
    CONSTRAINT "OutlineReference_outlineNodeId_fkey" FOREIGN KEY ("outlineNodeId") REFERENCES "OutlineNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutlineReference_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormatRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "pageMargins" TEXT NOT NULL DEFAULT '{}',
    "lineSpacing" REAL NOT NULL DEFAULT 1.5,
    "headingStyles" TEXT NOT NULL DEFAULT '{}',
    "bodyFont" TEXT NOT NULL DEFAULT '{}',
    "headerFooter" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "FormatRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CitationStyle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "formatType" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT '{}'
);

-- CreateTable
CREATE TABLE "ProjectCitationStyle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "citationStyleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ProjectCitationStyle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectCitationStyle_citationStyleId_fkey" FOREIGN KEY ("citationStyleId") REFERENCES "CitationStyle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OutlineNode_projectId_idx" ON "OutlineNode"("projectId");

-- CreateIndex
CREATE INDEX "OutlineNode_parentId_idx" ON "OutlineNode"("parentId");

-- CreateIndex
CREATE INDEX "Reference_projectId_idx" ON "Reference"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Reference_projectId_doi_key" ON "Reference"("projectId", "doi");

-- CreateIndex
CREATE UNIQUE INDEX "OutlineReference_outlineNodeId_referenceId_key" ON "OutlineReference"("outlineNodeId", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "FormatRule_projectId_key" ON "FormatRule"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CitationStyle_name_key" ON "CitationStyle"("name");

-- CreateIndex
CREATE INDEX "ProjectCitationStyle_projectId_idx" ON "ProjectCitationStyle"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCitationStyle_projectId_citationStyleId_key" ON "ProjectCitationStyle"("projectId", "citationStyleId");
