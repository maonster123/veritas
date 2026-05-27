# Thesis Outline — Data Model Design

## Overview

论文大纲管理系统，完整论文项目管理的 SaaS 工具。核心能力：大纲结构管理、参考文献库、排版格式可配置、Word + PDF 输出。

## Scope Decisions

| 维度 | 决定 |
|------|------|
| 大纲结构 | 无限制层级（树形自引用） |
| 参考文献 | DOI 自动抓取元数据，无 PDF 附件 |
| 排版输出 | Word + PDF，架构预留可扩展 |
| 格式支持 | GB/T 7714 + APA 7th + IEEE + MLA |
| 用户系统 | 先做核心模型，认证/支付后续加 |

## Tech Stack

- Next.js 16.2.6 + TypeScript
- Prisma 7.8.0 + SQLite
- Tailwind CSS 4
- 排版引擎 / DOI 抓取库：待实现阶段选定

## Entity Model

### 1. Project（论文项目）

每篇论文一个独立项目，拥有自己的大纲树、参考文献库和排版设置。

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | PK |
| title | String | 论文标题 |
| subtitle | String? | 副标题 |
| description | String? | 项目描述 |
| status | Enum | draft / writing / reviewing / completed |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### 2. OutlineNode（大纲节点）

树形自引用，支持无限制层级。根节点 parentId = null。每个节点可独立写作。

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | PK |
| projectId | String | FK → Project |
| parentId | String? | FK → self，null = 根节点 |
| sortOrder | Int | 同级排序 |
| title | String | 节点标题 |
| type | Enum | chapter / section / subsection / paragraph |
| content | String? | Markdown 写作内容 |
| notes | String? | 个人备注，不输出到最终文档 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### 3. Reference（参考文献）

存储原始文献元数据，格式化输出由 CitationStyle 控制。

| Field | Type | Notes |
|-------|------|------|
| id | String (UUID) | PK |
| projectId | String | FK → Project |
| doi | String? | 唯一标识，用于去重和抓取 |
| title | String | 文献标题 |
| authors | JSON | [{given, family, order}] |
| journal | String? | 期刊/会议名 |
| volume | String? | 卷 |
| issue | String? | 期 |
| pages | String? | 页码 |
| year | Int? | 出版年 |
| publisher | String? | 出版社 |
| url | String? | 在线链接 |
| abstract | String? | 摘要 |
| rawBibtex | String? | 抓取到的原始 BibTeX |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### 4. OutlineReference（大纲-文献关联）

N:N 关联表，记录大纲节点引用了哪些文献。

| Field | Type | Notes |
|-------|------|------|
| id | String (UUID) | PK |
| outlineNodeId | String | FK → OutlineNode |
| referenceId | String | FK → Reference |
| citationText | String? | 文中引用标记，如 "[1]" 或 "(Author, 2024)" |

### 5. FormatRule（排版规则）

JSON 存储排版参数，每个 Project 关联一套。

| Field | Type | Notes |
|-------|------|------|
| id | String (UUID) | PK |
| projectId | String | FK → Project (unique) |
| pageMargins | JSON | {top, bottom, left, right} in mm |
| lineSpacing | Float | 行距倍数 |
| headingStyles | JSON | {level1: {font, size, bold, ...}, level2: {...}, ...} |
| bodyFont | JSON | {family, size} |
| headerFooter | JSON | 页眉页脚配置 |

### 6. CitationStyle（引用格式）

引用格式定义，用于参考文献列表和文中引用的格式化。

| Field | Type | Notes |
|-------|------|------|
| id | String (UUID) | PK |
| name | String | "GB/T 7714-2015", "APA 7th", "IEEE", "MLA 9th" |
| formatType | Enum | numeric / author_year / author_page |
| template | JSON | CSL-like 模板定义 |

### 7. ProjectCitationStyle（项目-引用格式关联）

Project 可启用多种引用格式，当前活跃的标记为 active。

| Field | Type | Notes |
|-------|------|------|
| id | String (UUID) | PK |
| projectId | String | FK → Project |
| citationStyleId | String | FK → CitationStyle |
| isActive | Boolean | 当前使用的格式 |

## Relationships

```
Project 1 ──→ N OutlineNode          (outline tree)
OutlineNode 1 ──→ N OutlineNode      (self-ref, children)
Project 1 ──→ N Reference             (reference library)
OutlineNode N ──→ N Reference         (via OutlineReference)
Project 1 ──→ 1 FormatRule            (formatting config)
Project N ──→ N CitationStyle         (via ProjectCitationStyle)
```

## Output Flow

```
Project → OutlineNode (tree traversal)
       → FormatRule (layout parameters)
       → OutlineReference → Reference (citations)
       → ProjectCitationStyle → CitationStyle (formatting rules)
       ↓
   排版引擎 → Word (.docx) + PDF
```

## Implementation Phases

1. **Prisma schema + migrations** — 核心 5 个模型建表
2. **DOI 文献抓取** — 输入 DOI，拉取元数据
3. **大纲编辑器 UI** — 树形拖拽 + Markdown 编辑
4. **排版引擎** — 默认模板先跑通 Word + PDF 输出
5. **引用格式化** — 支持 GB/T 7714 + APA + IEEE + MLA
6. **用户系统** — 认证 + 付费（后期）

## Open Questions

- 排版引擎技术选型：Pandoc / docx.js / jspdf / 其他（Phase 3 时决定）
- DOI 抓取 API：CrossRef / DataCite（Phase 2 时决定）
- SQLite 升级路径：单体 SQLite → PostgreSQL 迁移方案（用户量上来前不处理）
