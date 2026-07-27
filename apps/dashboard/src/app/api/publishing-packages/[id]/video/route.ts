import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import { streamStorageObject } from "@/lib/stream-video";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brand = await requireCurrentBrand();

  const pkg = await prisma.publishingPackage.findFirst({
    where: { id, brandId: brand.id },
    include: { renderedClipAsset: true },
  });
  if (!pkg?.renderedClipAsset.storageKey) return new Response("Not found", { status: 404 });

  return streamStorageObject(req, pkg.renderedClipAsset.storageKey);
}
