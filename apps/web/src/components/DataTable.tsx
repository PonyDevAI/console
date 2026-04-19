import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { cn } from "../lib/utils";

type SortState<T> = {
  key: keyof T;
  direction: "asc" | "desc";
} | null;

export type DataTableColumn<T> = {
  key: keyof T;
  header: string;
  accessor?: (row: T) => string | number | null;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  width?: string;
};

type DataTableProps<T extends { id?: string }> = {
  columns: DataTableColumn<T>[];
  data: T[];
  emptyText?: string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  expandedRowRender?: (row: T) => ReactNode;
  expandedRowIds?: Set<string>;
};

export default function DataTable<T extends { id?: string }>({
  columns,
  data,
  emptyText = "暂无数据",
  onRowClick,
  rowClassName,
  expandedRowRender,
  expandedRowIds,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState<T>>(null);

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return data;

    return [...data].sort((a, b) => {
      const av = column.accessor ? column.accessor(a) : ((a[sort.key] as string | number | null) ?? "");
      const bv = column.accessor ? column.accessor(b) : ((b[sort.key] as string | number | null) ?? "");

      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      const result = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
      return sort.direction === "asc" ? result : -result;
    });
  }, [columns, data, sort]);

  const toggleSort = (key: keyof T) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  const renderSortIcon = (key: keyof T) => {
    if (!sort || sort.key !== key) return <ArrowUpDown className="h-3 w-3 text-[var(--muted)]" />;
    return sort.direction === "asc" ? (
      <ArrowUp className="h-3 w-3 text-[var(--accent)]" />
    ) : (
      <ArrowDown className="h-3 w-3 text-[var(--accent)]" />
    );
  };

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--bg-accent)] text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className="px-4 py-3 text-left"
                style={column.width ? { width: column.width } : undefined}
              >
                {column.sortable ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className="flex items-center gap-1.5 text-left hover:text-[var(--text)] cursor-pointer"
                  >
                    <span>{column.header}</span>
                    {renderSortIcon(column.key)}
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-sm text-[var(--muted)]" colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          ) : (
            sortedData.map((row, rowIndex) => {
              const rowId = String(row.id ?? rowIndex);
              const expanded = expandedRowIds?.has(rowId) ?? false;
              return (
                <Fragment key={rowId}>
                  <tr
                    className={cn(
                      "border-b border-[var(--border)] transition-colors hover:bg-[var(--bg-hover)]",
                      onRowClick ? "cursor-pointer" : "",
                      rowClassName ? rowClassName(row) : "",
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((column) => (
                      <td key={String(column.key)} className="px-4 py-3 align-top">
                        {column.render ? column.render(row) : String(row[column.key] ?? "-")}
                      </td>
                    ))}
                  </tr>
                  {expanded && expandedRowRender ? (
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-accent)]/50">
                      <td colSpan={columns.length} className="px-4 py-3">
                        {expandedRowRender(row)}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
