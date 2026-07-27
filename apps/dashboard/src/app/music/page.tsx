import Link from "next/link";
import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import UploadForm from "./UploadForm";
import DeleteButton from "./DeleteButton";
import styles from "../library.module.css";

export default async function MusicPage() {
  const brand = await requireCurrentBrand();
  const tracks = await prisma.musicTrack.findMany({
    where: { brandId: brand.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1>Music — {brand.name}</h1>
        <Link href="/">Back</Link>
      </div>

      <UploadForm />

      {tracks.length === 0 ? (
        <p className={styles.empty}>No tracks yet — upload one above.</p>
      ) : (
        <ul className={styles.list}>
          {tracks.map((t) => (
            <li key={t.id} className={styles.item}>
              <div className={styles.itemBody}>
                <div className={styles.itemName}>{t.name}</div>
                <div className={styles.itemMeta}>
                  {t.licenseSource} · {t.licenseType}
                  {t.licenseExpiresAt && ` · expires ${t.licenseExpiresAt.toLocaleDateString()}`}
                </div>
                <audio controls src={`/api/music-tracks/${t.id}/audio`} style={{ marginTop: 6 }} />
              </div>
              <DeleteButton id={t.id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
