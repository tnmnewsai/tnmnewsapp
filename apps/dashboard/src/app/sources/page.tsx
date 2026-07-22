import Link from "next/link";
import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import AddSourceForm from "./AddSourceForm";
import { createSourceAsset } from "./actions";
import styles from "./sources.module.css";

export default async function SourcesPage() {
  const brand = await requireCurrentBrand();
  const sources = await prisma.sourceAsset.findMany({
    where: { brandId: brand.id },
    orderBy: { createdAt: "desc" },
    include: { transcript: true },
  });

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1>Sources — {brand.name}</h1>
        <Link href="/">Back</Link>
      </div>

      <AddSourceForm action={createSourceAsset} />

      {sources.length === 0 ? (
        <p className={styles.empty}>No sources yet — add one above.</p>
      ) : (
        <ul className={styles.list}>
          {sources.map((source) => (
            <li key={source.id}>
              <Link href={`/sources/${source.id}`}>
                {source.originalFilename ?? source.sourceUrl ?? source.id}
              </Link>
              <span className={styles.badge}>{source.status}</span>
              {source.transcript && (
                <span className={styles.badge}>transcript: {source.transcript.status}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
