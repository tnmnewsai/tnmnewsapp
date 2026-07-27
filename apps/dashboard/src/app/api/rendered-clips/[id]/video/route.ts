import type { NextRequest } from "next/server";
import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import { streamStorageObject } from "@/lib/stream-video";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brand = await requireCurrentBrand();

  const rendered = await prisma.renderedClipAsset.findFirst({
    where: { id, clip: { brandId: brand.id } },
  });
  if (!rendered?.storageKey) {
    return new Response("Not found", { status: 404 });
  }

  return streamStorageObject(req, rendered.storageKey);
}
