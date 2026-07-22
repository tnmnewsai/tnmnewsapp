import Link from "next/link";
import { auth, signOut } from "@/auth";
import { prisma } from "@svt/db";
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
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <Link href="/sources">Sources →</Link>
      </section>
    </main>
  );
}
