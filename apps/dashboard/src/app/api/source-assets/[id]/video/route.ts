import type { NextRequest } from "next/server";
import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import { streamStorageObject } from "@/lib/stream-video";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brand = await requireCurrentBrand();

  const source = await prisma.sourceAsset.findFirst({ where: { id, brandId: brand.id } });
  if (!source?.storageKey) {
    return new Response("Not found", { status: 404 });
  }

  return streamStorageObject(req, source.storageKey);
}
