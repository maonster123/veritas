# User System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 添加用户注册/登录 + 项目归属隔离，完成多用户闭环。不含付费。

**Architecture:** Auth.js v5 + bcryptjs 密码哈希 + credentials provider（邮箱+密码）。所有数据按 userId 隔离。

**Tech Stack:** `next-auth@5` (beta), `bcryptjs`, `@auth/prisma-adapter`

---

## File Structure

```
prisma/
  schema.prisma              ← 修改: +User, Account, Session, VerificationToken; Project.userId
  migrations/                ← 创建
src/
  lib/
    auth.ts                  ← 创建: Auth.js 配置
  middleware.ts               ← 创建: 路由保护
  app/
    auth/
      login/page.tsx         ← 创建: 登录页
      register/page.tsx      ← 创建: 注册页
    actions/
      auth.ts                ← 创建: 注册/登录 Server Actions
      outline.ts             ← 修改: userId 过滤
    api/auth/[...nextauth]/
      route.ts               ← 创建: Auth.js handler
    page.tsx                 ← 修改: session 保护
```

---

### Task 1: Update Prisma Schema

**Files:** Modify `prisma/schema.prisma`

Add these models after the existing ones:

```prisma
// ──────────────────────────────────────────────
// 8. User
// ──────────────────────────────────────────────

model User {
  id            String    @id @default(uuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  passwordHash  String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  projects      Project[]
  accounts      Account[]
  sessions      Session[]
}

// ──────────────────────────────────────────────
// 9. Account (Auth.js)
// ──────────────────────────────────────────────

model Account {
  id                String  @id @default(uuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

// ──────────────────────────────────────────────
// 10. Session (Auth.js)
// ──────────────────────────────────────────────

model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ──────────────────────────────────────────────
// 11. VerificationToken (Auth.js)
// ──────────────────────────────────────────────

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

Also add `userId` to the **existing Project model**:

```prisma
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
```

(Add these two lines inside the Project model, before the closing `}`)

### Task 2: Run Migration

```bash
cd d:\thesis-outline && npx prisma migrate dev --name add_user_system
```

### Task 3: Install Dependencies

```bash
cd d:\thesis-outline && npm install next-auth@beta @auth/prisma-adapter bcryptjs && npm install -D @types/bcryptjs
```

### Task 4: Create Auth Configuration

**Files:** Create `src/lib/auth.ts`

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user || !user.passwordHash) return null;
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) return null;
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
      }
      return session;
    },
  },
});
```

### Task 5: Create Auth API Route + Middleware

**Files:**
- Create `src/app/api/auth/[...nextauth]/route.ts`
- Create `src/middleware.ts`

**route.ts:**
```typescript
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

**middleware.ts:**
```typescript
export { auth as middleware } from "@/lib/auth";
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|auth).*)"],
};
```

### Task 6: Create Auth Pages + Server Actions

**Files:**
- Create `src/app/actions/auth.ts`
- Create `src/app/auth/login/page.tsx`
- Create `src/app/auth/register/page.tsx`

**auth.ts server actions:**
```typescript
"use server";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";

export async function registerUser(
  name: string, email: string, password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { success: false, error: "该邮箱已被注册" };
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({ data: { name, email, passwordHash } });
    return { success: true };
  } catch {
    return { success: false, error: "注册失败" };
  }
}

export async function loginUser(
  email: string, password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await signIn("credentials", { email, password, redirect: false });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: "邮箱或密码错误" };
    }
    return { success: false, error: "登录失败" };
  }
}
```

**login/page.tsx:** Simple centered form with email + password + "登录" button + link to register.

**register/page.tsx:** Simple centered form with name + email + password + "注册" button + link to login.

### Task 7: Update Main Page for Auth

**Files:** Modify `src/app/page.tsx`

Wrap in auth check: import `auth` from `@/lib/auth`, get session at top. If no session, show login link. Pass userId to outline operations.

Also add a sign-out button in the header.

### Task 8: Update Seed Script

Add a test user creation. Update the existing project to have a userId.

### Task 9: End-to-End Test

- Register → login → create/use project with auth
- Verify 404/redirect for unauthenticated access

### Task 10: Commit
```bash
cd d:\thesis-outline && git add -A && git commit -m "feat: add user authentication with Auth.js"
```
