import type { AppVersionRow } from "@logly/utils";
import { versionColor } from "./version-colors";
import { formatSeen, formatShare } from "./versions-format";

const BUILDS_SHOWN = 3;

function VersionLabel({ row }: { row: AppVersionRow }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className="size-2 shrink-0 rounded-[2px]"
        style={{ background: versionColor(row) }}
      />
      {row.kind === "version" ? (
        <span className="truncate font-mono" title={row.label}>
          {row.label}
        </span>
      ) : (
        <span className="truncate italic text-muted-foreground">
          {row.kind === "other"
            ? `Other (${row.versionCount} versions)`
            : "Unknown (no appVersion)"}
        </span>
      )}
      {row.latest ? (
        <span className="shrink-0 rounded-full bg-[#347b56]/10 px-1.5 py-px text-[10px] font-medium text-[#347b56]">
          Latest
        </span>
      ) : null}
    </span>
  );
}

function Builds({ builds }: { builds: AppVersionRow["builds"] }) {
  if (!builds.length) return <span className="text-muted-foreground">—</span>;
  const shown = builds.slice(0, BUILDS_SHOWN);
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((build) => (
        <span
          key={build.build ?? "none"}
          className="rounded border bg-[#fbfaf7] px-1.5 py-px font-mono text-[10px]"
          title={`${build.users.toLocaleString()} users`}
        >
          {build.build ?? "no build"}{" "}
          <span className="text-muted-foreground">{build.users}</span>
        </span>
      ))}
      {builds.length > BUILDS_SHOWN ? (
        <span className="text-[10px] text-muted-foreground">
          +{builds.length - BUILDS_SHOWN} more
        </span>
      ) : null}
    </span>
  );
}

function ShareBar({
  users,
  share,
  color,
}: {
  users: number;
  share: number;
  color: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="w-8 text-right tabular-nums">
        {users.toLocaleString()}
      </span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f0ede7]">
        <span
          className="block h-full rounded-full"
          style={{
            width: `${Math.max(share * 100, users ? 2 : 0)}%`,
            background: color,
          }}
        />
      </span>
      <span className="w-9 text-right tabular-nums text-muted-foreground">
        {formatShare(share)}
      </span>
    </span>
  );
}

export function VersionsTable({ versions }: { versions: AppVersionRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-3 pt-4">
        <h3 className="text-[13px] font-semibold">Versions</h3>
        <span className="text-[11px] text-muted-foreground">
          Newest first · times in UTC
        </span>
      </div>
      {versions.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-xs">
            <thead>
              <tr className="border-y bg-[#fbfaf7] text-left text-[11px] text-muted-foreground">
                <th scope="col" className="px-[18px] py-2 font-medium">
                  Version
                </th>
                <th
                  scope="col"
                  className="w-[150px] px-3 py-2 font-medium"
                  title="Distinct users with any event on this version in the range"
                >
                  Active users · share
                </th>
                <th
                  scope="col"
                  className="w-[150px] px-3 py-2 font-medium"
                  title="Users whose latest event in the range was on this version"
                >
                  Still on it
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-3 py-2 text-right font-medium"
                  title="Users still on this version, by platform"
                >
                  iOS · Android
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Builds
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  First seen
                </th>
                <th scope="col" className="px-[18px] py-2 font-medium">
                  Last seen
                </th>
              </tr>
            </thead>
            <tbody>
              {versions.map((row) => (
                <tr key={row.key} className="border-b last:border-b-0">
                  <td className="max-w-[220px] px-[18px] py-2.5">
                    <VersionLabel row={row} />
                  </td>
                  <td className="px-3 py-2.5">
                    {row.activeUsers === null || row.activeShare === null ? (
                      <span
                        className="text-muted-foreground"
                        title="Users of grouped versions can't be de-duplicated"
                      >
                        —
                      </span>
                    ) : (
                      <ShareBar
                        users={row.activeUsers}
                        share={row.activeShare}
                        color={versionColor(row)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <ShareBar
                      users={row.currentUsers}
                      share={row.currentShare}
                      color={versionColor(row)}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {row.platforms.ios.toLocaleString()} ·{" "}
                    {row.platforms.android.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5">
                    <Builds builds={row.builds} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {formatSeen(row.firstSeen)}
                  </td>
                  <td className="whitespace-nowrap px-[18px] py-2.5 text-muted-foreground">
                    {formatSeen(row.lastSeen)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mx-[18px] mb-4 rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
          No mobile events in this range.
        </p>
      )}
    </section>
  );
}
