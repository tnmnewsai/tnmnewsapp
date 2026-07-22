import { redirect } from "next/navigation";
import { prisma } from "@svt/db";
import { auth } from "@/auth";

export async function requireCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

/**
 * Milestone 1 keeps brand selection simple: the user's first brand-scoped
 * membership. A brand switcher can come later once multi-brand users are
 * actually a thing we need to support in the UI.
 */
export async function requireCurrentBrand() {
  const user = await requireCurrentUser();
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, brandId: { not: null } },
    include: { brand: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership?.brand) {
    throw new Error(
      "This user has no brand membership yet — run the db seed script or add one via Prisma Studio.",
    );
  }

  return membership.brand;
}
