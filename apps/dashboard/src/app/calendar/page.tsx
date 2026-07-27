import Link from "next/link";
import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import CalendarDayCell from "./CalendarDayCell";
import BankedSidebar from "./BankedSidebar";
import styles from "./calendar.module.css";

function monthRangeUTC(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const daysInMonth = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const firstWeekday = start.getUTCDay();
  return { start, end, daysInMonth, firstWeekday };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const brand = await requireCurrentBrand();
  const { year: yearParam, month: monthParam } = await searchParams;

  const now = new Date();
  const year = yearParam ? Number(yearParam) : now.getUTCFullYear();
  const month = monthParam ? Number(monthParam) : now.getUTCMonth() + 1;

  const { start, end, daysInMonth, firstWeekday } = monthRangeUTC(year, month);

  const [scheduledPosts, bankedClips] = await Promise.all([
    prisma.scheduledPost.findMany({
      where: { brandId: brand.id, scheduledFor: { gte: start, lt: end } },
      include: { clip: true },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.clip.findMany({
      where: { brandId: brand.id, publishingApprovalStatus: "APPROVED", scheduledPosts: { none: {} } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const postsByDay = new Map<number, (typeof scheduledPosts)[number]>();
  for (const post of scheduledPosts) {
    postsByDay.set(new Date(post.scheduledFor).getUTCDate(), post);
  }

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1>Calendar</h1>
        <Link href="/sources">Back to sources</Link>
      </div>

      <p className={styles.help}>
        One canonical clip per day, posted to every connected platform — pick a day from the banked list to
        schedule it, or move/cancel an already-scheduled day below.
      </p>

      <div className={styles.layout}>
        <div className={styles.calendarSection}>
          <div className={styles.monthNav}>
            <Link href={`/calendar?year=${prevMonth.year}&month=${prevMonth.month}`}>← Prev</Link>
            <h2>
              {MONTH_NAMES[month - 1]} {year}
            </h2>
            <Link href={`/calendar?year=${nextMonth.year}&month=${nextMonth.month}`}>Next →</Link>
          </div>

          <div className={styles.grid}>
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className={styles.weekdayLabel}>
                {w}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={i} className={styles.emptyCell} />;
              const post = postsByDay.get(day);
              const dateIso = new Date(Date.UTC(year, month - 1, day)).toISOString();
              return (
                <CalendarDayCell
                  key={i}
                  day={day}
                  dateIso={dateIso}
                  scheduledPost={
                    post
                      ? {
                          id: post.id,
                          status: post.status,
                          clipTitle: post.clip.title,
                          clipHref: `/sources/${post.clip.sourceAssetId}/clips/${post.clipId}`,
                        }
                      : null
                  }
                />
              );
            })}
          </div>
        </div>

        <BankedSidebar
          clips={bankedClips.map((c) => ({
            id: c.id,
            title: c.title,
            clipHref: `/sources/${c.sourceAssetId}/clips/${c.id}`,
          }))}
        />
      </div>
    </main>
  );
}
