"use server";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

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
    // Validate credentials first
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return { success: false, error: "邮箱或密码错误" };
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return { success: false, error: "邮箱或密码错误" };
    }
    // Sign in and redirect server-side
    await signIn("credentials", { email, password, redirect: false });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: "邮箱或密码错误" };
    }
    return { success: false, error: error instanceof Error ? error.message : "登录失败" };
  }
}
