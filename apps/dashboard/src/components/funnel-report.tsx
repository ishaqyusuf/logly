import { Button } from "@logly/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@logly/ui/card";
import { Field, FieldGroup, FieldLabel } from "@logly/ui/field";
import { NativeSelect } from "@logly/ui/native-select";
import type { AnalyticsFunnel } from "@logly/utils";

export function FunnelReport({
  project,
  organization,
  names,
  selectedSteps,
  report,
  error,
}: {
  project: string;
  organization?: string;
  names: string[];
  selectedSteps: string[];
  report: AnalyticsFunnel | null;
  error?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion funnel</CardTitle>
        <CardDescription>
          See where visitor-days drop off between ordered events in the last 30
          days.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form action="/insights" method="get" className="flex flex-col gap-4">
          <input type="hidden" name="project" value={project} />
          {organization && (
            <input type="hidden" name="organization" value={organization} />
          )}
          <FieldGroup className="sm:grid sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => (
              <Field key={index}>
                <FieldLabel htmlFor={`funnel-step-${index}`}>
                  Step {index + 1}
                  {index > 1 ? " (optional)" : ""}
                </FieldLabel>
                <NativeSelect
                  id={`funnel-step-${index}`}
                  name={`step${index + 1}`}
                  defaultValue={selectedSteps[index] ?? ""}
                  required={index < 2}
                >
                  <option value="">
                    {index < 2 ? "Choose event" : "No step"}
                  </option>
                  {[...new Set([...names, ...selectedSteps])].map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ))}
          </FieldGroup>
          <Button
            type="submit"
            className="self-start"
            disabled={names.length === 0}
          >
            Analyze funnel
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
        {!report && !error && (
          <p className="text-sm text-muted-foreground">
            Choose at least two events to measure conversion. Repeating an event
            requires a later occurrence.
          </p>
        )}
        {report && (
          <ol className="flex flex-col gap-4" aria-label="Funnel results">
            {report.steps.map((step, index) => (
              <li key={`${index}-${step.name}`} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 break-all">
                    {index + 1}. {step.name}
                  </span>
                  <span className="tabular-nums">
                    {step.visitors.toLocaleString()} visitor-days ·{" "}
                    {step.conversion}% of entrants
                  </span>
                </div>
                <div
                  className="h-3 overflow-hidden rounded-full bg-muted"
                  aria-hidden="true"
                >
                  <div
                    className="h-full bg-foreground"
                    style={{ width: `${step.conversion}%` }}
                  />
                </div>
                {index > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {step.dropOff.toLocaleString()} dropped off from the
                    previous step
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Each visitor counts once per UTC day. Steps must occur at later
          timestamps within that day; server events and events without a visitor
          key are excluded. This is not a cross-day customer funnel.
        </p>
      </CardFooter>
    </Card>
  );
}
