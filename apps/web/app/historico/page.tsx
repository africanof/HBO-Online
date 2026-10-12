"use client";
import { useEffect, useState } from "react";
import { loadHistory, clearHistory, itemHref, SAVED_KIND_LABELS, type HistoryEntry } from "@huambo-online/core";
import { browserStore } from "../../components/Engage";
import { LiteImg } from "../../components/LiteImg";

export default function Historico() {
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  useEffect(() => { void loadHistory(browserStore).then(setItems); }, []);
  return <main className="stack">
    <a href="/">← Huambo Online</a>
    <h1>Vistos recentemente</h1>
    <p>Fica guardado só neste aparelho.</p>
    {items && items.length > 0 && <button className="secondary" style={{ justifySelf: "start" }} onClick={async () => { await clearHistory(browserStore); setItems([]); }}>Limpar histórico</button>}
    {items?.length === 0 && <p>Ainda não viu nenhum anúncio, produto, profissional ou empresa.</p>}
    <section className="grid">{items?.map(x => <a key={x.kind + x.id} href={itemHref(x.kind, x.id)} className="card" style={{ color: "inherit", textDecoration: "none" }}>
      {x.image ? <LiteImg className="thumb" src={x.image} alt="" /> : null}
      <small>{SAVED_KIND_LABELS[x.kind]} · {new Date(x.at).toLocaleString("pt-AO")}</small>
      <strong>{x.title}</strong>
    </a>)}</section>
  </main>;
}
