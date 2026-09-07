"use client";

import { Badge } from "@logly/ui/badge";
import { Button } from "@logly/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@logly/ui/card";
import type { CountryVisits } from "@logly/utils";
import { useState } from "react";
import countries from "@/data/world-map.json";

export function CountryReport({ summary }: { summary: CountryVisits }) {
  const [selected, setSelected] = useState<string | null>(null);
  const byCode = new Map(
    summary.countries.map((country) => [country.code, country]),
  );
  const maximum = Math.max(
    1,
    ...summary.countries.map((country) => country.count),
  );
  const active = selected ? byCode.get(selected) : undefined;
  const known = summary.totalVisits - summary.unknownVisits;
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Visits around the world</CardTitle>
          <Badge variant="outline">
            {summary.countries.length} countries ·{" "}
            {summary.totalVisits.toLocaleString("en-US")} visits
          </Badge>
        </div>
        <CardDescription>
          Visits by country over the last 30 days. Select a country to see its
          share.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            {/* biome-ignore lint/a11y/useSemanticElements: SVG groups cannot be represented by an HTML fieldset. The country buttons also have an equivalent ranked list. */}
            <svg
              viewBox="0 0 1000 500"
              role="group"
              aria-label="World map of visits by country. The ranked list provides the same counts."
              className="w-full rounded-lg bg-muted/30"
            >
              <title>World map of visits by country</title>
              {countries.map((country, index) => {
                const data = byCode.get(country.code);
                return (
                  // biome-ignore lint/a11y/useSemanticElements: Country polygons are SVG paths; keyboard activation and an equivalent HTML button list are provided.
                  <path
                    key={`${country.code}-${index}`}
                    d={country.path}
                    fill="currentColor"
                    fillRule="evenodd"
                    stroke="hsl(var(--background))"
                    strokeWidth={0.6}
                    vectorEffect="non-scaling-stroke"
                    className={data ? "text-primary" : "text-muted-foreground"}
                    onClick={data ? () => setSelected(country.code) : undefined}
                    onKeyDown={
                      data
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelected(country.code);
                            }
                          }
                        : undefined
                    }
                    tabIndex={data ? 0 : undefined}
                    role="button"
                    aria-disabled={!data}
                    aria-label={
                      data ? `${data.name}: ${data.count} visits` : undefined
                    }
                    style={
                      data
                        ? {
                            cursor: "pointer",
                            strokeWidth: selected === country.code ? 2 : 0.6,
                          }
                        : undefined
                    }
                    opacity={
                      data ? 0.3 + 0.7 * Math.sqrt(data.count / maximum) : 0.15
                    }
                  >
                    <title>
                      {`${data?.name ?? country.name}: ${data ? `${data.count.toLocaleString("en-US")} visits` : "No recorded country visits"}`}
                    </title>
                  </path>
                );
              })}
            </svg>
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Darker countries have more visits</span>
              <span>
                {known.toLocaleString("en-US")} located ·{" "}
                {summary.unknownVisits.toLocaleString("en-US")} unknown
              </span>
            </div>
            <p aria-live="polite" className="min-h-6 text-sm">
              {active
                ? `${active.name}: ${active.count.toLocaleString("en-US")} visits (${((active.count / Math.max(1, summary.totalVisits)) * 100).toFixed(1)}% of all visits)`
                : "Select a country from the list to inspect its visits."}
            </p>
          </div>
          <div className="min-w-0">
            {summary.countries.length ? (
              <ol
                aria-label="Countries ranked by visits"
                className="flex max-h-80 flex-col gap-1 overflow-y-auto"
              >
                {summary.countries.map((country) => (
                  <li key={country.code}>
                    <Button
                      variant={selected === country.code ? "outline" : "ghost"}
                      className="h-auto min-h-11 w-full justify-between gap-3 whitespace-normal text-left"
                      aria-pressed={selected === country.code}
                      onClick={() => setSelected(country.code)}
                    >
                      <span className="min-w-0">{country.name}</span>
                      <span className="shrink-0 tabular-nums">
                        {country.count.toLocaleString("en-US")}{" "}
                        <span className="text-muted-foreground">
                          ·{" "}
                          {(
                            (country.count / Math.max(1, summary.totalVisits)) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </span>
                    </Button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-6 text-sm text-muted-foreground">
                {summary.totalVisits
                  ? "These visits have no country information yet. New visits appear here when country forwarding is enabled."
                  : "No visits in this period. Countries will appear after the first tracked visit."}
              </p>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Counts daily visit arrivals, not every pageview. Country is
          approximate and reflects the network when events are sent; VPNs and
          delayed delivery can affect it. Unknown visits stay in the total. No
          GPS or IP address is stored for this report. Map: Natural Earth.
        </p>
      </CardFooter>
    </Card>
  );
}
