import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import AutoRefresh from "../AutoRefresh";
import styles from "../sources.module.css";

interface TranscriptWord {
  word: string;
}

export default async function SourceAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brand = await requireCurrentBrand();

  const source = await prisma.sourceAsset.findFirst({
    where: { id, brandId: brand.id },
    include: { transcript: true },
  });

  if (!source) notFound();

  const stillWorking =
    source.status === "PENDING" ||
    source.status === "FETCHING" ||
    (source.status === "READY" &&
      (!source.transcript ||
        source.transcript.status === "PENDING" ||
        source.transcript.status === "PROCESSING"));

  const words = (source.transcript?.rawWords as TranscriptWord[] | null) ?? null;

  return (
    <main className={styles.page}>
      {stillWorking && <AutoRefresh />}

      <div className={styles.header}>
        <h1>{source.originalFilename ?? source.sourceUrl ?? "Source"}</h1>
        <Link href="/sources">Back</Link>
      </div>

      <p>
        <span className={styles.badge}>{source.type}</span>{" "}
        <span className={styles.badge}>{source.status}</span>{" "}
        {source.transcript && (
          <span className={styles.badge}>transcript: {source.transcript.status}</span>
        )}
      </p>

      {source.status === "FAILED" && source.errorMessage && (
        <p style={{ color: "#b3261e" }}>{source.errorMessage}</p>
      )}

      {source.transcript?.status === "FAILED" && source.transcript.errorMessage && (
        <p style={{ color: "#b3261e" }}>Transcription failed: {source.transcript.errorMessage}</p>
      )}

      {source.transcript?.status === "READY" && words && (
        <div>
          <h2>Transcript</h2>
          <p style={{ lineHeight: 1.7 }}>{words.map((w) => w.word).join(" ")}</p>
        </div>
      )}
    </main>
  );
}
