export default function DataTable({
  columns,
  data,
  emptyMessage = "No records found.",
  keyField = "id",
}) {
  if (!data || data.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-ink-secondary dark:text-neutral-400 font-medium">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Desktop / Tablet Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm border-collapse text-left">
          <thead>
            <tr className="border-b border-black/[0.06] dark:border-white/[0.08] text-ink-secondary dark:text-neutral-400 text-xs uppercase tracking-wider font-semibold">
              {columns.map((col) => (
                <th key={col.key} className="py-3 px-4 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {data.map((row, i) => (
              <tr
                key={row[keyField] || i}
                className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors duration-150"
              >
                {columns.map((col) => (
                  <td key={col.key} className="py-3.5 px-4 align-middle text-ink dark:text-neutral-200">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Card View (Responsive Requirement) */}
      <div className="sm:hidden space-y-3">
        {data.map((row, i) => (
          <div
            key={row[keyField] || i}
            className="p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] space-y-2.5"
          >
            {columns.map((col) => (
              <div key={col.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-ink-secondary dark:text-neutral-400 uppercase tracking-wider text-[11px]">
                  {col.label}
                </span>
                <span className="text-ink dark:text-neutral-200 text-right">
                  {col.render ? col.render(row) : row[col.key]}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
