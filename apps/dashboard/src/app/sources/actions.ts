"use server";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type SourceAssetType } from "@svt/db";
import { getStorage, sourceAssetStorageKey } from "@svt/storage";
import { createQueue, QUEUE_NAMES } from "@svt/queue";
import { requireCurrentBrand, requireCurrentUser } from "@/lib/current-brand";

export async function createSourceAsset(formData: FormData): Promise<void> {
  const type = formData.get("type") as SourceAssetType;
  const rightsAttestation = formData.get("rightsAttestation") === "on";

  if (!rightsAttestation) {
    throw new Error("You must confirm you have the rights to use this content.");
  }

  const brand = await requireCurrentBrand();
  const user = await requireCurrentUser();

  let sourceAssetId: string;

  if (type === "VIDEO_UPLOAD") {
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) throw new Error("Choose a video file to upload.");

    const created = await prisma.sourceAsset.create({
      data: {
        brandId: brand.id,
        type,
        originalFilename: file.name,
        rightsAttestation: true,
        createdByUserId: user.id,
      },
    });

    const ext = path.extname(file.name).replace(".", "") || "mp4";
    const tempPath = path.join(os.tmpdir(), `svt-upload-${created.id}.${ext}`);
    fs.writeFileSync(tempPath, Buffer.from(await file.arrayBuffer()));

    const key = sourceAssetStorageKey(brand.id, created.id, ext);
    await getStorage().putFile(key, tempPath);
    fs.rmSync(tempPath, { force: true });

    await prisma.sourceAsset.update({
      where: { id: created.id },
      data: { status: "READY", storageKey: key },
    });

    sourceAssetId = created.id;
  } else {
    const url = (formData.get("url") as string | null)?.trim();
    if (!url) throw new Error("Enter a source URL.");

    const created = await prisma.sourceAsset.create({
      data: {
        brandId: brand.id,
        type,
        sourceUrl: url,
        rightsAttestation: true,
        createdByUserId: user.id,
      },
    });

    sourceAssetId = created.id;
  }

  const queue = createQueue<{ sourceAssetId: string }>(QUEUE_NAMES.sourceAssetPipeline);
  await queue.add("process", { sourceAssetId });

  revalidatePath("/sources");
  redirect(`/sources/${sourceAssetId}`);
}
