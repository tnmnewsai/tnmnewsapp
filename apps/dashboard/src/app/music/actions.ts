"use server";

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@svt/db";
import { getStorage, musicTrackStorageKey } from "@svt/storage";
import { requireCurrentBrand } from "@/lib/current-brand";

export async function uploadMusicTrack(formData: FormData): Promise<void> {
  const brand = await requireCurrentBrand();
  const name = (formData.get("name") as string | null)?.trim();
  const file = formData.get("file") as File | null;
  const licenseSource = (formData.get("licenseSource") as string | null)?.trim();
  const licenseType = (formData.get("licenseType") as string | null)?.trim();
  const licenseAttribution = (formData.get("licenseAttribution") as string | null)?.trim() || null;
  const licenseExpiresAtRaw = formData.get("licenseExpiresAt") as string | null;

  if (!name) throw new Error("Give the track a name.");
  if (!file || file.size === 0) throw new Error("Choose an audio file.");
  if (!licenseSource) throw new Error("Enter where this track came from.");
  if (!licenseType) throw new Error("Enter the license type.");

  const id = randomUUID();
  const ext = path.extname(file.name).replace(".", "") || "mp3";
  const tempPath = path.join(os.tmpdir(), `svt-music-${id}.${ext}`);
  fs.writeFileSync(tempPath, Buffer.from(await file.arrayBuffer()));

  const key = musicTrackStorageKey(brand.id, id, ext);
  await getStorage().putFile(key, tempPath);
  fs.rmSync(tempPath, { force: true });

  await prisma.musicTrack.create({
    data: {
      id,
      brandId: brand.id,
      name,
      storageKey: key,
      licenseSource,
      licenseType,
      licenseAttribution,
      licenseExpiresAt: licenseExpiresAtRaw ? new Date(licenseExpiresAtRaw) : null,
    },
  });

  revalidatePath("/music");
}

export async function deleteMusicTrack(id: string): Promise<void> {
  const brand = await requireCurrentBrand();
  const track = await prisma.musicTrack.findFirst({ where: { id, brandId: brand.id } });
  if (!track) throw new Error("Track not found.");

  await prisma.musicTrack.delete({ where: { id } });
  revalidatePath("/music");
}
