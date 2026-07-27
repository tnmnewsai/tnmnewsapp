import Link from "next/link";
import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import styles from "./analytics.module.css";

export default async function AnalyticsPage() {
  const brand = await requireCurrentBrand();

  const results = await prisma.platformPostResult.findMany({
    where: { status: "SUCCESS", publishingPackage: { brandId: brand.id } },
    include: {
      publishingPackage: { include: { clip: true } },
      // Most recently *captured* snapshot, not just the one with the
      // furthest-out due date — a not-yet-due 7d/weekly pull has no data.
      analyticsSnapshots: { where: { status: "SUCCESS" }, orderBy: { capturedAt: "desc" }, take: 1 },
    },
    orderBy: { publishedAt: "desc" },
  });

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1>Analytics</h1>
        <Link href="/sources">Back to sources</Link>
      </div>

      <p className={styles.help}>
        Metrics are pulled automatically at +1h, +24h, +7d, then weekly — nothing to trigger here.
      </p>

      {results.length === 0 ? (
        <p className={styles.empty}>Nothing published yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Clip</th>
                <th>Platform</th>
                <th>Published</th>
                <th>Views</th>
                <th>Likes</th>
                <th>Comments</th>
                <th>Shares</th>
                <th>Last pulled</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const latest = r.analyticsSnapshots[0];
                return (
                  <tr key={r.id}>
                    <td>
                      <Link
                        href={`/sources/${r.publishingPackage.clip.sourceAssetId}/clips/${r.publishingPackage.clipId}`}
                      >
                        {r.publishingPackage.clip.title}
                      </Link>
                    </td>
                    <td>{r.platform}</td>
                    <td>{r.publishedAt ? new Date(r.publishedAt).toLocaleString() : "—"}</td>
                    <td>{latest?.views ?? "—"}</td>
                    <td>{latest?.likes ?? "—"}</td>
                    <td>{latest?.comments ?? "—"}</td>
                    <td>{latest?.shares ?? "—"}</td>
                    <td>{latest?.capturedAt ? new Date(latest.capturedAt).toLocaleString() : "pending"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
