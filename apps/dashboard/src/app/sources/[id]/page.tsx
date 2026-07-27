import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import AutoRefresh from "../AutoRefresh";
import TranscriptEditor from "../TranscriptEditor";
import NewClipSection from "../NewClipSection";
import GenerateCandidatesForm from "../GenerateCandidatesForm";
import CandidateCard from "../CandidateCard";
import styles from "../sources.module.css";

interface TranscriptWord {
  word: string;
  startMs: number;
  endMs: number;
  confidence?: number;
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
    include: {
      transcript: true,
      clips: { orderBy: { createdAt: "desc" } },
      clipCandidates: { where: { status: "PENDING" }, orderBy: { confidence: "desc" } },
      clipCandidateBatches: { orderBy: { createdAt: "desc" }, take: 1 },
      blogArticle: true,
      videoScript: { include: { segments: { orderBy: { order: "asc" } } } },
    },
  });

  if (!source) notFound();

  const latestBatch = source.clipCandidateBatches[0];
  const batchInProgress =
    latestBatch && (latestBatch.status === "PENDING" || latestBatch.status === "PROCESSING");

  const stillWorking =
    source.status === "PENDING" ||
    source.status === "FETCHING" ||
    (source.status === "READY" &&
      (!source.transcript ||
        source.transcript.status === "PENDING" ||
        source.transcript.status === "PROCESSING")) ||
    Boolean(batchInProgress);

  const correctedWords = source.transcript?.correctedWords as TranscriptWord[] | null;
  const rawWords = source.transcript?.rawWords as TranscriptWord[] | null;
  const words = correctedWords ?? rawWords;

  const videoSrc = `/api/source-assets/${source.id}/video`;
  const defaultEndMs = Math.min(5000, source.durationMs ?? 5000);

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

      {source.type === "BLOG_URL" && (
        <section>
          <h2>Video script</h2>
          {!source.blogArticle && <p>Fetching the article…</p>}
          {source.blogArticle && !source.videoScript && <p>Preparing narration script…</p>}
          {source.videoScript?.status === "PROCESSING" && <p>Generating narration script…</p>}
          {source.videoScript?.status === "FAILED" && source.videoScript.errorMessage && (
            <p style={{ color: "#b3261e" }}>{source.videoScript.errorMessage}</p>
          )}
          {source.videoScript?.status === "READY" && source.status !== "READY" && source.status !== "FAILED" && (
            <p>Synthesizing narration, generating visuals, and assembling the video…</p>
          )}
          {source.videoScript && source.videoScript.segments.length > 0 && (
            <ol className={styles.list}>
              {source.videoScript.segments.map((segment) => (
                <li key={segment.id}>
                  {segment.narrationText}
                  {segment.durationMs != null && (
                    <span className={styles.badge}> {(segment.durationMs / 1000).toFixed(1)}s</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {source.status === "READY" && (
        <section>
          <h2>New clip</h2>
          <NewClipSection
            sourceAssetId={source.id}
            videoSrc={videoSrc}
            defaultEndMs={defaultEndMs}
          />
        </section>
      )}

      {source.transcript?.status === "READY" && (
        <section>
          <h2>AI clip candidates</h2>
          <GenerateCandidatesForm sourceAssetId={source.id} />

          {latestBatch?.status === "PROCESSING" && <p>Generating {latestBatch.targetCount} candidates…</p>}
          {latestBatch?.status === "FAILED" && latestBatch.errorMessage && (
            <p style={{ color: "#b3261e" }}>{latestBatch.errorMessage}</p>
          )}

          {source.clipCandidates.length > 0 && (
            <ul className={styles.candidateList}>
              {source.clipCandidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  sourceAssetId={source.id}
                  candidate={candidate}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {source.clips.length > 0 && (
        <section>
          <h2>Clips</h2>
          <ul className={styles.list}>
            {source.clips.map((clip) => (
              <li key={clip.id}>
                <Link href={`/sources/${source.id}/clips/${clip.id}`}>{clip.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {source.transcript?.status === "READY" && words && (
        <section>
          <h2>Transcript</h2>
          <TranscriptEditor sourceAssetId={source.id} initialWords={words} />
        </section>
      )}
    </main>
  );
}
