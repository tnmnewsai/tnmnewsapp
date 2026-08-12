"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./workspace-frame.module.css";

const workspaceLinks = [
  { label: "Dashboard", href: "/", icon: "⌂" },
  { label: "Sources", href: "/sources", icon: "▶" },
  { label: "Content review", href: "/review", icon: "✓" },
  { label: "Publishing review", href: "/publishing-review", icon: "↑" },
  { label: "Calendar", href: "/calendar", icon: "□" },
  { label: "Analytics", href: "/analytics", icon: "⌁" },
];

const libraryLinks = [
  { label: "Brand templates", href: "/brand-templates", icon: "◇" },
  { label: "Music", href: "/music", icon: "♪" },
  { label: "Graphics", href: "/graphics", icon: "▧" },
  { label: "Platforms", href: "/platforms", icon: "◎" },
];

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalone = pathname === "/login" || pathname === "/signup";

  // The dashboard owns the richer, data-aware version of this same chrome.
  if (isStandalone || pathname === "/") return children;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoMark}>▶</span>
          <span>Social Video</span>
        </Link>

        <nav className={styles.nav} aria-label="Workspace navigation">
          <p>Workspace</p>
          {workspaceLinks.map((item) => (
            <Link key={item.href} href={item.href} className={isCurrent(pathname, item.href) ? styles.active : undefined}>
              <span className={styles.icon}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          <p>Brand library</p>
          {libraryLinks.map((item) => (
            <Link key={item.href} href={item.href} className={isCurrent(pathname, item.href) ? styles.active : undefined}>
              <span className={styles.icon}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className={styles.footer}>
          <Link href="/admin" className={isCurrent(pathname, "/admin") ? styles.active : undefined}>
            <span className={styles.icon}>⚙</span>
            <span>Admin &amp; operations</span>
          </Link>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.mobileHeader}>
          <Link href="/" className={styles.mobileLogo}><span className={styles.logoMark}>▶</span> Social Video</Link>
          <span>{[...workspaceLinks, ...libraryLinks].find((item) => isCurrent(pathname, item.href))?.label ?? "Workspace"}</span>
        </header>
        {children}
      </div>
    </div>
  );
}
