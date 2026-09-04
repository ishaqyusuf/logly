import type { AnalyticsOverview } from "@logly/utils";
import {
  ArrowDownRight,
  ArrowUpRight,
  MousePointerClick,
  Send,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";

export function SummaryGrid({ overview }: { overview: AnalyticsOverview }) {
  const returningShare = overview.uniqueVisitors
    ? Math.round((overview.returningVisitors / overview.uniqueVisitors) * 100)
    : 0;
  const cards = [
    {
      label: "Unique visitors",
      value: overview.uniqueVisitors,
      change: overview.change.visitors,
      icon: UsersRound,
      bars: [34, 48, 41, 62, 57, 74, 78],
    },
    {
      label: "New visitors",
      value: overview.newVisitors,
      suffix: `${100 - returningShare}%`,
      icon: UserRoundPlus,
      bars: [68, 52, 61, 44, 55, 48, 57],
    },
    {
      label: "Returning",
      value: overview.returningVisitors,
      suffix: `${returningShare}%`,
      icon: MousePointerClick,
      bars: [31, 37, 45, 54, 50, 63, 71],
    },
    {
      label: "Events",
      value: overview.totalEvents,
      change: overview.change.events,
      icon: Send,
      bars: [45, 39, 58, 52, 67, 61, 82],
    },
  ];

  return (
    <section className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-white shadow-soft sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const positive = (card.change ?? 0) >= 0;
        return (
          <article
            key={card.label}
            className={`relative min-h-[150px] p-5 ${index > 0 ? "border-t border-border sm:border-t-0 sm:border-l" : ""} ${index === 2 ? "sm:border-l-0 lg:border-l" : ""}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <Icon className="h-4 w-4 text-[#a09c93]" />
            </div>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-[28px] font-medium tracking-[-0.04em] tabular-nums">
                  {card.value.toLocaleString()}
                </p>
                {card.change !== undefined ? (
                  <p
                    className={`mt-2 flex items-center gap-1 text-[11px] ${positive ? "text-emerald-700" : "text-red-600"}`}
                  >
                    {positive ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {Math.abs(card.change)}% vs prior period
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {card.suffix} of visitors
                  </p>
                )}
              </div>
              <div className="flex h-11 items-end gap-1" aria-hidden>
                {card.bars.map((height, barIndex) => (
                  <span
                    key={`${card.label}-${barIndex}`}
                    className="w-1.5 rounded-sm bg-[#dce9df] last:bg-[#4f8c68]"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
