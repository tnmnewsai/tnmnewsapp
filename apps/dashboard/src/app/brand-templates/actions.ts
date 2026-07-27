"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import type { BrandTemplateConfig } from "@svt/workflow/client";

export async function createBrandTemplateVersion(formData: FormData): Promise<void> {
  const brand = await requireCurrentBrand();

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) throw new Error("Give the template a name.");

  const config: BrandTemplateConfig = {
    captionFontSize: Number(formData.get("captionFontSize")) || 56,
    captionColor: (formData.get("captionColor") as string) || "#ffffff",
    captionBackgroundColor: (formData.get("captionBackgroundColor") as string) || "#000000cc",
    captionPosition: (formData.get("captionPosition") as BrandTemplateConfig["captionPosition"]) || "bottom",
    accentColor: (formData.get("accentColor") as string) || "#b8791f",
    logoGraphicAssetId: (formData.get("logoGraphicAssetId") as string) || undefined,
    logoPosition:
      (formData.get("logoPosition") as BrandTemplateConfig["logoPosition"]) || "top-right",
  };

  const latest = await prisma.brandTemplate.findFirst({
    where: { brandId: brand.id },
    orderBy: { version: "desc" },
  });

  await prisma.brandTemplate.create({
    data: {
      brandId: brand.id,
      name,
      version: (latest?.version ?? 0) + 1,
      config: config as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/brand-templates");
}
