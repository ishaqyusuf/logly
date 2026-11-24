import type { AnalyticsAppVersionsReport } from "@logly/utils";
import { versionColor } from "./version-colors";
import { formatShare } from "./versions-format";

const PLATFORM_LABELS = {
  ios: "iOS",
  android: "Android",
  unknown: "Unknown platform",
} as const;

export function VersionsPlatforms({
  platforms,
  activeUsers,
}: {
  platforms: AnalyticsAppVersionsReport["platforms"];
  activeUsers: number;
}) {
  return (
    <section className="rounded-xl border bg-white shadow-soft">
      <div className="px-[18px] pb-3 pt-4">
        <h3 className="text-[13px] font-semibold">By platform</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Version mix of each platform's active users
        </p>
      </div>
      {platforms.length ? (
        <div className="grid gap-4 px-[18px] pb-4 md:grid-cols-2">
          {platforms.map((platform) => (
            <div
              key={platform.platform}
              className="min-w-0 rounded-lg border bg-[#fbfaf7] p-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium">
                  {PLATFORM_LABELS[platform.platform]}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {platform.users.toLocaleString()} users ·{" "}
                  {formatShare(activeUsers ? platform.users / activeUsers : 0)}
                </span>
              </div>
              <div
                className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-[#f0ede7]"
                role="img"
                aria-label={platform.versions
                  .map((entry) => `${entry.label} ${formatShare(entry.share)}`)
                  .join(", ")}
              >
                {platform.versions.map((entry) => (
                  <span
                    key={entry.key}
                    className="h-full"
                    style={{
                      width: `${entry.share * 100}%`,
                      background: versionColor(entry),
                    }}
                  />
                ))}
              </div>
              <ol className="mt-2.5 space-y-1">
                {platform.versions.map((entry) => (
                  <li
                    key={entry.key}
                    className="flex items-center justify-between gap-3 text-[11px]"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="size-2 shrink-0 rounded-[2px]"
                        style={{ background: versionColor(entry) }}
                      />
                      <span
                        className={
                          entry.kind === "version"
                            ? "truncate font-mono"
                            : "truncate italic text-muted-foreground"
                        }
                      >
                        {entry.label}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {entry.users.toLocaleString()} ·{" "}
                      {formatShare(entry.share)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      ) : (
        <p className="mx-[18px] mb-4 rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
          No identified app users in this range.
        </p>
      )}
    </section>
  );
}
