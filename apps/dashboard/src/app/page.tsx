import Link from "next/link";
import { auth, signOut } from "@/auth";
import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import BrandSwitcher from "./BrandSwitcher";
import styles from "./page.module.css";

type IconName =
  | "home"
  | "source"
  | "review"
  | "publish"
  | "calendar"
  | "analytics"
  | "brand"
  | "music"
  | "graphics"
  | "settings"
  | "plus"
  | "arrow"
  | "sparkles"
  | "play"
  | "check"
  | "clock";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></>,
    source: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="m10 8 6 4-6 4Z"/></>,
    review: <><path d="M9 11l2 2 4-4"/><path d="M20 12a8 8 0 1 1-3-5.9"/></>,
    publish: <><path d="M12 19V5"/><path d="m6 11 6-6 6 6"/><path d="M5 19h14"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    analytics: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
    brand: <><path d="M12 3 4 7v10l8 4 8-4V7Z"/><path d="m4 7 8 4 8-4M12 11v10"/></>,
    music: <><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></>,
    graphics: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m3 16 5-4 4 3 3-2 6 5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    sparkles: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2Z"/><path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8Z"/></>,
    play: <path d="m9 7 8 5-8 5Z"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]}</svg>;
}

const nav = [
  ["Dashboard", "/", "home"], ["Sources", "/sources", "source"],
  ["Content review", "/review", "review"], ["Publishing review", "/publishing-review", "publish"],
  ["Calendar", "/calendar", "calendar"], ["Analytics", "/analytics", "analytics"],
] as const;
const libraryNav = [
  ["Brand templates", "/brand-templates", "brand"], ["Music", "/music", "music"],
  ["Graphics", "/graphics", "graphics"], ["Platforms", "/platforms", "settings"],
] as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: value > 9999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function relativeDate(date: Date) {
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diff / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

export default async function Home() {
  const session = await auth();
  const user = session?.user;
  const memberships = user?.id ? await prisma.membership.findMany({
    where: { userId: user.id }, include: { account: true, brand: true },
  }) : [];
  const brandMemberships = memberships.filter((m) => m.brand);
  const currentBrand = brandMemberships.length ? await requireCurrentBrand() : null;

  if (!currentBrand) {
    return <main className={styles.emptyState}><div className={styles.logoMark}><Icon name="play" size={20}/></div><h1>Welcome to Social Video Tool</h1><p>No brand membership is connected to this account yet.</p><form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}><button>Sign out</button></form></main>;
  }

  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 86_400_000);
  const [sourceCount, clipCount, contentReviewCount, publishingReviewCount, scheduledCount, publishedCount, recentSources, upcomingPosts, platformAccounts, analytics] = await Promise.all([
    prisma.sourceAsset.count({ where: { brandId: currentBrand.id } }),
    prisma.clip.count({ where: { brandId: currentBrand.id } }),
    prisma.renderedClipAsset.count({ where: { clip: { brandId: currentBrand.id }, contentApprovalStatus: "PENDING_REVIEW" } }),
    prisma.clip.count({ where: { brandId: currentBrand.id, publishingApprovalStatus: "PENDING_REVIEW" } }),
    prisma.scheduledPost.count({ where: { brandId: currentBrand.id, status: "SCHEDULED", scheduledFor: { gte: now } } }),
    prisma.platformPostResult.count({ where: { status: "SUCCESS", publishingPackage: { brandId: currentBrand.id } } }),
    prisma.sourceAsset.findMany({ where: { brandId: currentBrand.id }, include: { transcript: true, _count: { select: { clips: true } } }, orderBy: { createdAt: "desc" }, take: 4 }),
    prisma.scheduledPost.findMany({ where: { brandId: currentBrand.id, scheduledFor: { gte: now, lte: weekEnd } }, include: { clip: true, publishingPackages: true }, orderBy: { scheduledFor: "asc" }, take: 4 }),
    prisma.platformAccount.findMany({ where: { brandId: currentBrand.id }, orderBy: { platform: "asc" } }),
    prisma.analyticsSnapshot.aggregate({ where: { status: "SUCCESS", platformPostResult: { publishingPackage: { brandId: currentBrand.id } } }, _sum: { views: true, likes: true } }),
  ]);

  const firstName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there";
  const initials = (user?.name || user?.email || "SV").split(/[\s@]/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  const totalPending = contentReviewCount + publishingReviewCount;
  const pipeline = [
    { label: "Sources", value: sourceCount, icon: "source" as const, href: "/sources", tone: "purple" },
    { label: "Clips created", value: clipCount, icon: "sparkles" as const, href: "/sources", tone: "blue" },
    { label: "Awaiting review", value: totalPending, icon: "review" as const, href: "/review", tone: "amber" },
    { label: "Scheduled", value: scheduledCount, icon: "calendar" as const, href: "/calendar", tone: "green" },
  ];

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.logo}><span className={styles.logoMark}><Icon name="play" size={18}/></span><span>Social Video</span></Link>
        <BrandSwitcher
          currentBrandId={currentBrand.id}
          currentBrandName={currentBrand.name}
          options={brandMemberships.map((m) => ({ brandId: m.brandId!, name: m.brand!.name }))}
        />
        <nav className={styles.nav} aria-label="Main navigation">
          <p>Workspace</p>
          {nav.map(([label, href, icon], index) => <Link key={href} href={href} className={index === 0 ? styles.activeNav : ""}><Icon name={icon}/><span>{label}</span>{label === "Content review" && contentReviewCount > 0 && <b>{contentReviewCount}</b>}{label === "Publishing review" && publishingReviewCount > 0 && <b>{publishingReviewCount}</b>}</Link>)}
          <p>Brand library</p>
          {libraryNav.map(([label, href, icon]) => <Link key={href} href={href}><Icon name={icon}/><span>{label}</span></Link>)}
        </nav>
        <div className={styles.sidebarFooter}>
          <Link href="/admin"><Icon name="settings"/><span>Admin &amp; operations</span></Link>
          <div className={styles.profile}><span className={styles.avatar}>{initials}</span><span><strong>{user?.name || "Team member"}</strong><small>{user?.email}</small></span></div>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.mobileLogo}><span className={styles.logoMark}><Icon name="play" size={16}/></span> Social Video</div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}><button className={styles.signOut} type="submit">Sign out</button></form>
        </header>

        <div className={styles.content}>
          <section className={styles.welcome}>
            <div><p className={styles.eyebrow}>SHORTS AUTOMATION DASHBOARD</p><h1>Good {now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"}, {firstName}.</h1><p>Here&apos;s what&apos;s happening with {currentBrand.name}&apos;s content pipeline.</p></div>
            <Link href="/sources" className={styles.primaryButton}><Icon name="plus"/> Add new source</Link>
          </section>

          {totalPending > 0 && <section className={styles.alert}><span className={styles.alertIcon}><Icon name="clock"/></span><div><strong>{totalPending} item{totalPending === 1 ? "" : "s"} need your attention</strong><p>{contentReviewCount} in content review · {publishingReviewCount} in publishing review</p></div><Link href={contentReviewCount ? "/review" : "/publishing-review"}>Review now <Icon name="arrow" size={16}/></Link></section>}

          <section className={styles.statsGrid}>
            {pipeline.map((item) => <Link href={item.href} key={item.label} className={styles.statCard}><span className={`${styles.statIcon} ${styles[item.tone]}`}><Icon name={item.icon}/></span><span><small>{item.label}</small><strong>{formatNumber(item.value)}</strong></span><Icon name="arrow" size={17}/></Link>)}
          </section>

          <div className={styles.dashboardGrid}>
            <section className={styles.card}>
              <div className={styles.cardHeader}><div><h2>Recent sources</h2><p>Your latest imported content</p></div><Link href="/sources">View all <Icon name="arrow" size={15}/></Link></div>
              {recentSources.length ? <div className={styles.sourceList}>{recentSources.map((source) => {
                const title = source.originalFilename || source.sourceUrl || "Untitled source";
                const ready = source.status === "READY";
                return <Link href={`/sources/${source.id}`} key={source.id} className={styles.sourceRow}><span className={styles.thumbnail}><Icon name={source.type === "BLOG_URL" ? "source" : "play"}/></span><span className={styles.sourceInfo}><strong>{title}</strong><small>{source.type.replaceAll("_", " ").toLowerCase()} · {relativeDate(source.createdAt)}</small></span><span className={`${styles.status} ${ready ? styles.success : source.status === "FAILED" ? styles.danger : styles.processing}`}>{ready ? <Icon name="check" size={13}/> : null}{source.status.toLowerCase()}</span><span className={styles.clipCount}>{source._count.clips} clip{source._count.clips === 1 ? "" : "s"}</span></Link>;
              })}</div> : <div className={styles.blank}><Icon name="source" size={25}/><strong>No sources yet</strong><p>Add a video, YouTube link, Drive file, or article to begin.</p><Link href="/sources">Add your first source</Link></div>}
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}><div><h2>Upcoming</h2><p>Scheduled for the next 7 days</p></div><Link href="/calendar">Calendar <Icon name="arrow" size={15}/></Link></div>
              {upcomingPosts.length ? <div className={styles.scheduleList}>{upcomingPosts.map((post) => <Link href={`/sources/${post.clip.sourceAssetId}/clips/${post.clipId}`} key={post.id} className={styles.scheduleRow}><span className={styles.dateTile}><strong>{post.scheduledFor.toLocaleDateString("en-US", { day: "2-digit", timeZone: "UTC" })}</strong><small>{post.scheduledFor.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}</small></span><span><strong>{post.clip.title}</strong><small>{post.scheduledFor.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {post.publishingPackages.length || "All"} platforms</small></span><span className={`${styles.status} ${styles.scheduled}`}>{post.status.toLowerCase()}</span></Link>)}</div> : <div className={styles.blank}><Icon name="calendar" size={25}/><strong>Your week is open</strong><p>Approved shorts will appear here once scheduled.</p><Link href="/calendar">Open calendar</Link></div>}
            </section>
          </div>

          <div className={styles.bottomGrid}>
            <section className={styles.card}><div className={styles.cardHeader}><div><h2>Performance snapshot</h2><p>Lifetime automated publishing metrics</p></div><Link href="/analytics">Analytics <Icon name="arrow" size={15}/></Link></div><div className={styles.performance}><div><small>Total views</small><strong>{formatNumber(analytics._sum.views || 0)}</strong></div><div><small>Total likes</small><strong>{formatNumber(analytics._sum.likes || 0)}</strong></div><div><small>Posts published</small><strong>{formatNumber(publishedCount)}</strong></div></div></section>
            <section className={styles.card}><div className={styles.cardHeader}><div><h2>Connected platforms</h2><p>Publishing destinations</p></div><Link href="/platforms">Manage <Icon name="arrow" size={15}/></Link></div><div className={styles.platforms}>{["YOUTUBE", "TIKTOK", "INSTAGRAM", "X"].map((platform) => { const connected = platformAccounts.some((account) => account.platform === platform); return <span key={platform} className={connected ? styles.connected : ""}><i>{platform === "YOUTUBE" ? "▶" : platform === "TIKTOK" ? "♪" : platform === "INSTAGRAM" ? "◎" : "𝕏"}</i><span>{platform === "YOUTUBE" ? "YouTube" : platform === "TIKTOK" ? "TikTok" : platform === "INSTAGRAM" ? "Instagram" : "X"}<small>{connected ? "Connected" : "Not connected"}</small></span></span>; })}</div></section>
          </div>
        </div>
      </main>
    </div>
  );
}
