"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CURRENT_BRAND_COOKIE, listCurrentUserBrandMemberships } from "@/lib/current-brand";

export async function switchBrand(formData: FormData): Promise<void> {
  const brandId = formData.get("brandId") as string | null;
  if (!brandId) throw new Error("Missing brandId.");

  const memberships = await listCurrentUserBrandMemberships();
  if (!memberships.some((m) => m.brandId === brandId)) {
    throw new Error("You don't have a membership on that brand.");
  }

  const cookieStore = await cookies();
  cookieStore.set(CURRENT_BRAND_COOKIE, brandId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/");
}
