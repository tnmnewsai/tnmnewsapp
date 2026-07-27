"use server";

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@svt/db";
import { getStorage, graphicAssetStorageKey } from "@svt/storage";
import { requireCurrentBrand } from "@/lib/current-brand";

export async function uploadGraphicAsset(formData: FormData): Promise<void> {
  const brand = await requireCurrentBrand();
  const name = (formData.get("name") as string | null)?.trim();
  const file = formData.get("file") as File | null;

  if (!name) throw new Error("Give the graphic a name.");
  if (!file || file.size === 0) throw new Error("Choose an image file.");

  const id = randomUUID();
  const ext = path.extname(file.name).replace(".", "") || "png";
  const tempPath = path.join(os.tmpdir(), `svt-graphic-${id}.${ext}`);
  fs.writeFileSync(tempPath, Buffer.from(await file.arrayBuffer()));

  const key = graphicAssetStorageKey(brand.id, id, ext);
  await getStorage().putFile(key, tempPath);
  fs.rmSync(tempPath, { force: true });

  await prisma.graphicAsset.create({ data: { id, brandId: brand.id, name, storageKey: key } });

  revalidatePath("/graphics");
}

export async function deleteGraphicAsset(id: string): Promise<void> {
  const brand = await requireCurrentBrand();
  const asset = await prisma.graphicAsset.findFirst({ where: { id, brandId: brand.id } });
  if (!asset) throw new Error("Graphic not found.");

  await prisma.graphicAsset.delete({ where: { id } });
  revalidatePath("/graphics");
}
