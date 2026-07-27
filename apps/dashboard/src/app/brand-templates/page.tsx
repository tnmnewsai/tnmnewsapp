import Link from "next/link";
import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import CreateVersionForm from "./CreateVersionForm";
import styles from "../library.module.css";
import type { BrandTemplateConfig } from "@svt/workflow/client";

export default async function BrandTemplatesPage() {
  const brand = await requireCurrentBrand();
  const [templates, graphicAssets] = await Promise.all([
    prisma.brandTemplate.findMany({ where: { brandId: brand.id }, orderBy: { version: "desc" } }),
    prisma.graphicAsset.findMany({ where: { brandId: brand.id }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1>Brand templates — {brand.name}</h1>
        <Link href="/">Back</Link>
      </div>

      <CreateVersionForm graphicAssets={graphicAssets.map((g) => ({ id: g.id, name: g.name }))} />

      {templates.length === 0 ? (
        <p className={styles.empty}>
          No template versions yet — create one above. Renders use the highest version by default.
        </p>
      ) : (
        <ul className={styles.list}>
          {templates.map((t, i) => {
            const config = t.config as unknown as BrandTemplateConfig;
            return (
              <li key={t.id} className={styles.item}>
                <div className={styles.itemBody}>
                  <div className={styles.itemName}>
                    {t.name} <span className={styles.badge}>v{t.version}</span>{" "}
                    {i === 0 && <span className={styles.badge}>current</span>}
                  </div>
                  <div className={styles.itemMeta}>
                    Captions {config.captionPosition}, {config.captionFontSize}px · logo{" "}
                    {config.logoGraphicAssetId ? config.logoPosition : "none"}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
