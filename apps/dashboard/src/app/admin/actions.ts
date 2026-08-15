"use server";

import { prisma } from "@svt/db";
import { hashPassword, verifyPassword } from "@svt/auth";
import { signOut } from "@/auth";
import { requireCurrentUser } from "@/lib/current-brand";

async function requireVerifiedUser(currentPassword: string) {
  const sessionUser = await requireCurrentUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new Error("Current password is incorrect.");
  }
  return user;
}

export async function updateOwnEmail(newEmail: string, currentPassword: string): Promise<void> {
  const email = newEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  const user = await requireVerifiedUser(currentPassword);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== user.id) throw new Error("That email address is already in use.");
  await prisma.user.update({ where: { id: user.id }, data: { email } });
  await signOut({ redirectTo: "/login" });
}

export async function updateOwnPassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
  if (newPassword.length < 12) throw new Error("New password must be at least 12 characters.");
  if (newPassword !== confirmPassword) throw new Error("New passwords do not match.");
  if (newPassword === currentPassword) throw new Error("Choose a different password.");
  const user = await requireVerifiedUser(currentPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
  await signOut({ redirectTo: "/login" });
}
