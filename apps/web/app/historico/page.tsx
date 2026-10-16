"use client";
import { useEffect, useState } from "react";
import { loadHistory, clearHistory, itemHref, SAVED_KIND_LABELS, LANG_TAGS, type HistoryEntry } from "@huambo-online/core";
import { browserStore } from "../../components/Engage";
import { LiteImg } from "../../components/LiteImg";
import { useT } from "../../lib/i18n";

export default function Historico() {
  const { lang, t, tc } = useT();
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  useEffect(() => { void loadHistory(browserStore).then(setItems); }, []);
  return <main className="stack">
    <a href="/">← Huambo Online</a>
    <h1>{t("web.recent")}</h1>
    <p>{t("ls.only_this_device")}</p>
    {items && items.length > 0 && <button className="secondary" style={{ justifySelf: "start" }} onClick={async () => { await clearHistory(browserStore); setItems([]); }}>{t("ls.clear_history")}</button>}
    {items?.length === 0 && <p>{t("ls.history_empty")}</p>}
    <section className="grid">{items?.map(x => <a key={x.kind + x.id} href={itemHref(x.kind, x.id)} className="card" style={{ color: "inherit", textDecoration: "none" }}>
      {x.image ? <LiteImg className="thumb" src={x.image} alt="" /> : null}
      <small>{tc(SAVED_KIND_LABELS[x.kind])} · {new Date(x.at).toLocaleString(LANG_TAGS[lang])}</small>
      <strong>{x.title}</strong>
    </a>)}</section>
  </main>;
}
