"use client";
import { useEffect, useState } from "react";
import { useT } from "../lib/i18n";

/** Vista grelha/lista, guardada neste navegador (igual em todas as páginas de resultados). */
export function useViewMode(): ["grid" | "list", (v: "grid" | "list") => void] {
  const [view, setView] = useState<"grid" | "list">("grid");
  useEffect(() => { try { const v = localStorage.getItem("huambo:vista"); if (v === "list" || v === "grid") setView(v); } catch { /* sem armazenamento */ } }, []);
  return [view, v => { setView(v); try { localStorage.setItem("huambo:vista", v); } catch { /* sem armazenamento */ } }];
}

/** Barra por cima dos resultados: número, ordenar e grelha/lista (como no eBay e no OLX). */
export function ResultsToolbar<S extends string>({ count, sort, sorts, onSort, view, onView, children }: {
  count: string; sort: S; sorts: { value: S; label: string }[]; onSort: (v: S) => void; view?: "grid" | "list"; onView?: (v: "grid" | "list") => void; children?: React.ReactNode;
}) {
  const { t } = useT();
  return <div className="results-bar">
    <strong>{count}</strong>
    <div className="row" style={{ gap: 8 }}>
      <label className="sort-select"><span className="muted">{t("ls.sort")}</span>
        <select value={sort} onChange={e => onSort(e.target.value as S)}>{sorts.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
      {view && onView && <div className="view-toggle" role="group" aria-label={t("ls.view_mode")}>
        <button type="button" aria-pressed={view === "grid"} title={t("ls.view_grid")} aria-label={t("ls.view_grid")} onClick={() => onView("grid")}>▦</button>
        <button type="button" aria-pressed={view === "list"} title={t("ls.view_list")} aria-label={t("ls.view_list")} onClick={() => onView("list")}>☰</button>
      </div>}
      {children}
    </div>
  </div>;
}

/** No telemóvel, os filtros ficam atrás deste botão (no computador estão sempre à vista). */
export function FiltersToggle({ open, onToggle, active }: { open: boolean; onToggle: () => void; active: number }) {
  const { t } = useT();
  return <button type="button" className="secondary filters-toggle" aria-expanded={open} onClick={onToggle}>⚙️ {t("ls.filters")}{active ? ` (${active})` : ""}</button>;
}

/** Ordena por preço (os que não têm preço ficam no fim). */
export function byPrice<T extends { price?: number | null }>(list: T[], dir: "asc" | "desc"): T[] {
  const p = (x: T) => (typeof x.price === "number" && x.price > 0 ? x.price : null);
  return [...list].sort((a, b) => { const pa = p(a), pb = p(b); if (pa === null) return 1; if (pb === null) return -1; return dir === "asc" ? pa - pb : pb - pa; });
}
