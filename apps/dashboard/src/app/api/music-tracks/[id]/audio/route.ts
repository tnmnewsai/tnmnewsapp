import type { NextRequest } from "next/server";
import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import { streamStorageObject } from "@/lib/stream-video";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brand = await requireCurrentBrand();

  const track = await prisma.musicTrack.findFirst({ where: { id, brandId: brand.id } });
  if (!track) return new Response("Not found", { status: 404 });

  return streamStorageObject(req, track.storageKey);
}
