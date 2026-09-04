import { Button } from "@logly/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@logly/ui/dropdown-menu";
import { Columns3, Download } from "lucide-react";
import { EventSearchFilter } from "./event-search-filter";

const hideableColumns = ["identity", "route", "source", "time"];

export function EventHeader(props: {
  eventNames: string[];
  visible: Record<string, boolean>;
  onToggle: (id: string) => void;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <EventSearchFilter eventNames={props.eventNames} />
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="bg-background">
              <Columns3 className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Columns</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {hideableColumns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column}
                checked={props.visible[column] !== false}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={() => props.onToggle(column)}
                className="capitalize"
              >
                {column}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          className="bg-white"
          data-logly-event="export_clicked"
          data-logly-prop-format="json"
          onClick={props.onExport}
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Export</span>
        </Button>
      </div>
    </div>
  );
}
