import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import { streamStorageObject } from "@/lib/stream-video";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brand = await requireCurrentBrand();

  const thumbnail = await prisma.thumbnailAsset.findFirst({
    where: { id, clip: { brandId: brand.id } },
  });
  if (!thumbnail?.storageKey) return new Response("Not found", { status: 404 });

  return streamStorageObject(req, thumbnail.storageKey);
}
