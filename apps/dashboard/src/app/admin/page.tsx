import Link from "next/link";
import { prisma } from "@svt/db";
import { QUEUE_NAMES, getQueueJobCounts } from "@svt/queue";
import { requireAccountAdminAccounts, requireCurrentUser } from "@/lib/current-brand";
import AccountSecurityForm from "./AccountSecurityForm";
import styles from "./admin.module.css";

const JOB_TYPES = [
  { key: QUEUE_NAMES.sourceAssetPipeline, label: "Ingest/transcribe" },
  { key: QUEUE_NAMES.clipCandidateDetection, label: "Clip candidates" },
  { key: QUEUE_NAMES.generateThumbnail, label: "Thumbnails" },
  { key: QUEUE_NAMES.generatePostCopy, label: "Post copy" },
] as const;

export default async function AdminPage() {
  const [accounts, currentUser] = await Promise.all([requireAccountAdminAccounts(), requireCurrentUser()]);

  const accountViews = await Promise.all(
    accounts.map(async (account) => {
      const [brands, memberships] = await Promise.all([
        prisma.brand.findMany({ where: { accountId: account.id }, orderBy: { createdAt: "asc" } }),
        prisma.membership.findMany({
          where: { accountId: account.id },
          include: { user: true, brand: true },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      const brandQueueCounts = await Promise.all(
        brands.map(async (brand) => {
          const counts = await Promise.all(
            JOB_TYPES.map(async (jobType) => ({
              label: jobType.label,
              counts: await getQueueJobCounts(jobType.key, brand.id),
            })),
          );
          return { brand, counts };
        }),
      );

      return { account, brands, memberships, brandQueueCounts };
    }),
  );

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1>Admin / Ops</h1>
        <Link href="/">Back home</Link>
      </div>

      <AccountSecurityForm email={currentUser.email ?? ""} />

      {accountViews.map(({ account, memberships, brandQueueCounts }) => (
        <section key={account.id} className={styles.accountSection}>
          <h2>{account.name}</h2>

          <h3>Brands &amp; queue health</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Job type</th>
                  <th>Waiting</th>
                  <th>Active</th>
                  <th>Completed</th>
                  <th>Failed</th>
                  <th>Delayed</th>
                </tr>
              </thead>
              <tbody>
                {brandQueueCounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.empty}>
                      No brands under this account yet.
                    </td>
                  </tr>
                ) : (
                  brandQueueCounts.flatMap(({ brand, counts }) =>
                    counts.map((c, i) => (
                      <tr key={`${brand.id}-${c.label}`}>
                        {i === 0 ? (
                          <td rowSpan={counts.length} className={styles.brandCell}>
                            {brand.name}
                          </td>
                        ) : null}
                        <td>{c.label}</td>
                        <td>{c.counts.waiting}</td>
                        <td>{c.counts.active}</td>
                        <td>{c.counts.completed}</td>
                        <td className={c.counts.failed > 0 ? styles.failedCount : undefined}>
                          {c.counts.failed}
                        </td>
                        <td>{c.counts.delayed}</td>
                      </tr>
                    )),
                  )
                )}
              </tbody>
            </table>
          </div>

          <h3>Memberships</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Brand</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((m) => (
                  <tr key={m.id}>
                    <td>{m.user.email}</td>
                    <td>{m.brand?.name ?? "(account-wide)"}</td>
                    <td>{m.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </main>
  );
}
