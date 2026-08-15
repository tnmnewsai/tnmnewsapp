"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@svt/db";
import { hashPassword, verifyPassword } from "@svt/auth";
import { signOut } from "@/auth";
import { requireAccountAdminAccounts, requireCurrentUser } from "@/lib/current-brand";

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "brand"
  );
}

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

/**
 * Adds another Brand (property) to an existing Account — e.g. TNMN and
 * BecomingTKO as separate entities under the same account, each with its
 * own platform connections, queue, and content, exactly like the initial
 * signup flow's Account+Brand pair, minus creating a new Account/User.
 * Grants the creator a per-brand ADMIN membership so it immediately shows
 * up in their brand switcher — their existing account-wide ADMIN
 * membership already covers capability checks, but the switcher only
 * lists brand-scoped memberships (see listCurrentUserBrandMemberships).
 */
export async function createBrand(accountId: string, name: string): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Brand name is required.");

  const user = await requireCurrentUser();
  const adminAccounts = await requireAccountAdminAccounts();
  if (!adminAccounts.some((a) => a.id === accountId)) {
    throw new Error("You don't have admin access to this account.");
  }

  const slug = slugify(trimmedName);

  await prisma.$transaction(async (tx) => {
    const brand = await tx.brand.create({ data: { accountId, name: trimmedName, slug } });
    await tx.membership.create({
      data: { userId: user.id, accountId, brandId: brand.id, role: "ADMIN" },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/");
}
