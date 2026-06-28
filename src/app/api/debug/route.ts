import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. Environment
  results.env = {
    DATABASE_URL: process.env.DATABASE_URL ? "set (starts with " + process.env.DATABASE_URL.slice(0, 20) + "...)" : "MISSING",
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? "set" : "MISSING",
    AUTH_SECRET: process.env.AUTH_SECRET ? "set" : "MISSING",
    ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN ? "set" : "MISSING",
  };

  // 2. Database
  try {
    const users = await prisma.user.count();
    results.db = { status: "OK", userCount: users };
  } catch (e) {
    results.db = { status: "ERROR", error: (e as Error).message };
  }

  // 3. Citation styles
  try {
    const styles = await prisma.citationStyle.count();
    results.styles = { count: styles };
  } catch (e) {
    results.styles = { error: (e as Error).message };
  }

  // 4. Bcrypt test
  try {
    const hash = await bcrypt.hash("test123", 10);
    const valid = await bcrypt.compare("test123", hash);
    results.bcrypt = { status: valid ? "OK" : "FAIL" };
  } catch (e) {
    results.bcrypt = { error: (e as Error).message };
  }

  return NextResponse.json(results);
}
