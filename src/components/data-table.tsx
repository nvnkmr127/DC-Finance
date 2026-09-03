"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search, MoreHorizontal, Pencil, Trash2, Copy, Inbox } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RecordDialog, type Field } from "@/components/record-dialog";
import { cn } from "@/lib/utils";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "right";
};

type Row = { id: string } & Record<string, unknown>;

export function DataTable<T extends Row>({
  columns,
  rows,
  searchKeys,
  searchPlaceholder = "Search…",
  filters = [],
  editFields,
  editTitle,
  rowToValues,
  makeRow,
  onDataChange,
}: {
  columns: Column<T>[];
  rows: T[];
  searchKeys: (keyof T)[];
  searchPlaceholder?: string;
  filters?: { key: keyof T; placeholder: string; options: string[] }[];
  // If provided, each row gets Edit (opens a prefilled dialog).
  editFields?: Field[];
  editTitle?: string;
  rowToValues?: (row: T) => Record<string, string>;
  // Provide both to make Edit actually update the row.
  makeRow?: (values: Record<string, string>, existing: T) => T;
  // Controlled mode: when set, the parent owns the rows (so it can derive
  // summaries/charts) and DataTable reports every add/edit/delete here.
  onDataChange?: (rows: T[]) => void;
}) {
  const [internalData, setInternalData] = useState<T[]>(rows);
  const data = onDataChange ? rows : internalData;
  const applyChange = (fn: (rows: T[]) => T[]) =>
    onDataChange ? onDataChange(fn(rows)) : setInternalData(fn);
  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<T | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((row) => {
      const matchesQuery =
        !q ||
        searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q));
      const matchesFilters = filters.every((f) => {
        const v = filterValues[String(f.key)] ?? "all";
        return v === "all" || String(row[f.key]) === v;
      });
      return matchesQuery && matchesFilters;
    });
  }, [data, query, filterValues, searchKeys, filters]);

  const colSpan = columns.length + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        {filters.map((f) => {
          const key = String(f.key);
          return (
            <Select
              key={key}
              value={filterValues[key] ?? "all"}
              onValueChange={(v) =>
                setFilterValues((prev) => ({ ...prev, [key]: v }))
              }
            >
              <SelectTrigger className="sm:w-44">
                <SelectValue placeholder={f.placeholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{f.placeholder}</SelectItem>
                {f.options.map((o) => (
                  <SelectItem key={o} value={o} className="capitalize">
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c, i) => (
                <TableHead
                  key={i}
                  className={cn(c.align === "right" && "text-right", c.className)}
                >
                  {c.header}
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Inbox className="h-6 w-6" />
                    <span className="text-sm">No results found</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((c, i) => (
                    <TableCell
                      key={i}
                      className={cn(c.align === "right" && "text-right", c.className)}
                    >
                      {c.cell(row)}
                    </TableCell>
                  ))}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Row actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => navigator.clipboard?.writeText(row.id)}
                        >
                          <Copy className="h-4 w-4" />
                          Copy ID
                        </DropdownMenuItem>
                        {editFields && (
                          <DropdownMenuItem onSelect={() => setEditing(row)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() =>
                            applyChange((d) => d.filter((r) => r.id !== row.id))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editFields && (
        <RecordDialog
          title={editTitle ?? "Edit"}
          fields={editFields}
          open={editing !== null}
          onOpenChange={(o) => !o && setEditing(null)}
          initialValues={editing && rowToValues ? rowToValues(editing) : undefined}
          onSubmit={
            makeRow
              ? (values) => {
                  const current = editing;
                  if (!current) return;
                  applyChange((d) =>
                    d.map((r) =>
                      r.id === current.id ? makeRow(values, current) : r,
                    ),
                  );
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
