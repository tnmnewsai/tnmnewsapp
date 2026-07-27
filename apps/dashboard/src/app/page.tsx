import Link from "next/link";
import { auth, signOut } from "@/auth";
import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import { switchBrand } from "./switch-brand";
import styles from "./page.module.css";

export default async function Home() {
  const session = await auth();
  const user = session?.user;

  const memberships = user?.id
    ? await prisma.membership.findMany({
        where: { userId: user.id },
        include: { account: true, brand: true },
      })
    : [];

  const brandMemberships = memberships.filter((m) => m.brand);
  const currentBrand = brandMemberships.length > 0 ? await requireCurrentBrand() : null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Social Video Tool</h1>
          <p>Signed in as {user?.email}</p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit">Sign out</button>
        </form>
      </header>

      <section>
        <h2>Your brands</h2>
        {memberships.length === 0 ? (
          <p>No brand memberships yet — run the seed script to create one.</p>
        ) : (
          <ul>
            {memberships.map((m) => (
              <li key={m.id}>
                {m.brand?.name ?? "(account-wide)"} — {m.role}
                {m.brand && m.brandId === currentBrand?.id ? " (current)" : ""}
              </li>
            ))}
          </ul>
        )}
        {brandMemberships.length > 1 && currentBrand && (
          <form action={switchBrand} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <label htmlFor="brandId">Working on:</label>
            <select id="brandId" name="brandId" defaultValue={currentBrand.id}>
              {brandMemberships.map((m) => (
                <option key={m.brandId} value={m.brandId!}>
                  {m.brand!.name}
                </option>
              ))}
            </select>
            <button type="submit">Switch</button>
          </form>
        )}
      </section>

      <section style={{ display: "flex", gap: "1rem" }}>
        <Link href="/sources">Sources →</Link>
        <Link href="/review">Review queue →</Link>
        <Link href="/publishing-review">Publishing review →</Link>
        <Link href="/platforms">Platforms →</Link>
        <Link href="/calendar">Calendar →</Link>
        <Link href="/analytics">Analytics →</Link>
        <Link href="/brand-templates">Brand templates →</Link>
        <Link href="/music">Music →</Link>
        <Link href="/graphics">Graphics →</Link>
        <Link href="/admin">Admin / Ops →</Link>
      </section>
    </main>
  );
}
