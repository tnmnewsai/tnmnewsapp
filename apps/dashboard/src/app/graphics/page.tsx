import Link from "next/link";
import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import UploadForm from "./UploadForm";
import DeleteButton from "./DeleteButton";
import styles from "../library.module.css";

export default async function GraphicsPage() {
  const brand = await requireCurrentBrand();
  const graphics = await prisma.graphicAsset.findMany({
    where: { brandId: brand.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1>Graphics — {brand.name}</h1>
        <Link href="/">Back</Link>
      </div>

      <UploadForm />

      {graphics.length === 0 ? (
        <p className={styles.empty}>No graphics yet — upload a logo or overlay image above.</p>
      ) : (
        <ul className={styles.list}>
          {graphics.map((g) => (
            <li key={g.id} className={styles.item}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.thumb} src={`/api/graphic-assets/${g.id}/image`} alt={g.name} />
              <div className={styles.itemBody}>
                <div className={styles.itemName}>{g.name}</div>
              </div>
              <DeleteButton id={g.id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
