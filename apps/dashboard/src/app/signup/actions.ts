"use server";

import { prisma } from "@svt/db";
import { hashPassword } from "@svt/auth";
import { signIn } from "@/auth";

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "brand"
  );
}

/**
 * Self-service signup — creates a brand-new, fully isolated Account+Brand
 * for the signing-up user, not a membership on some existing shared
 * account. They get an ADMIN membership on their own new Brand plus an
 * account-wide ADMIN membership (brandId: null), the same two-membership
 * shape the db seed script sets up for the demo user — full control over
 * their own tenant (platform credentials, connected accounts, brands)
 * from the start, with nothing shared with anyone else's account.
 */
export async function registerAccount(formData: FormData): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const password = formData.get("password") as string | null;
  const brandName = (formData.get("brandName") as string | null)?.trim();

  if (!name || !email || !password || !brandName) {
    throw new Error("All fields are required.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("An account with this email already exists — try signing in instead.");
  }

  const passwordHash = await hashPassword(password);
  const slug = slugify(brandName);

  await prisma.$transaction(async (tx) => {
    const account = await tx.account.create({ data: { name: brandName } });
    const brand = await tx.brand.create({ data: { accountId: account.id, name: brandName, slug } });
    const user = await tx.user.create({ data: { email, name, passwordHash } });
    await tx.membership.create({
      data: { userId: user.id, accountId: account.id, brandId: brand.id, role: "ADMIN" },
    });
    await tx.membership.create({
      data: { userId: user.id, accountId: account.id, brandId: null, role: "ADMIN" },
    });
  });

  await signIn("credentials", { email, password, redirectTo: "/" });
}
