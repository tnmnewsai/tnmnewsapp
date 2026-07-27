import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@svt/db";
import { can, type Capability } from "@svt/auth";
import { auth } from "@/auth";

export const CURRENT_BRAND_COOKIE = "svt_current_brand_id";

export async function requireCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

/**
 * All of a user's brand-scoped memberships (account-wide grants, where
 * brandId is null, aren't a "current brand" choice — they apply everywhere
 * already). Ordered by createdAt so the default pick below is stable.
 */
export async function listCurrentUserBrandMemberships() {
  const user = await requireCurrentUser();
  return prisma.membership.findMany({
    where: { userId: user.id, brandId: { not: null } },
    include: { brand: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Picks the brand the user is currently operating on: the brand named by
 * the svt_current_brand_id cookie if the user actually has a membership
 * there, otherwise their first brand-scoped membership. The cookie only
 * ever gets set (via switchBrand) to a brand the user is a member of, but
 * we re-verify here anyway since a stale cookie could point at a brand
 * they've since lost access to.
 */
export async function requireCurrentBrand() {
  const memberships = await listCurrentUserBrandMemberships();
  if (memberships.length === 0) {
    throw new Error(
      "This user has no brand membership yet — run the db seed script or add one via Prisma Studio.",
    );
  }

  const cookieStore = await cookies();
  const selectedBrandId = cookieStore.get(CURRENT_BRAND_COOKIE)?.value;
  const selected = selectedBrandId
    ? memberships.find((m) => m.brandId === selectedBrandId)
    : undefined;

  return (selected ?? memberships[0]).brand!;
}

/**
 * Enforces a role-gated action (e.g. Gate 1's "clip:approve_content") against
 * the current user's brand-scoped memberships — checked here, not just
 * hidden in the UI, since a server action is reachable directly.
 */
export async function requireCapability(capability: Capability) {
  const user = await requireCurrentUser();
  const brand = await requireCurrentBrand();

  const memberships = await prisma.membership.findMany({ where: { userId: user.id } });
  if (!can(memberships, capability, { accountId: brand.accountId, brandId: brand.id })) {
    throw new Error(`You don't have permission to do that (requires ${capability}).`);
  }

  return { user, brand };
}

/**
 * Ops/admin tooling is account-wide (not brand-scoped) — only granted by an
 * account-wide ADMIN membership (brandId: null), never a brand-scoped one,
 * since it can see every brand under the account.
 */
export async function requireAccountAdminAccounts() {
  const user = await requireCurrentUser();
  const adminMemberships = await prisma.membership.findMany({
    where: { userId: user.id, brandId: null, role: "ADMIN" },
    include: { account: true },
  });

  if (adminMemberships.length === 0) {
    throw new Error("This page requires an account-wide ADMIN membership.");
  }

  return adminMemberships.map((m) => m.account);
}
