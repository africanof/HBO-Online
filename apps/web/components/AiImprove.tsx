"use client";
import { useState } from "react";
import { improveListingText, aiWriterMessage, canImproveText, type AiWriterInput } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";

/** Botão «✨ Melhorar com IA»: propõe um título e uma descrição melhores, com «voltar ao meu texto». */
export function AiImprove({ input, onApply }: { input: AiWriterInput; onApply: (title: string, description: string) => void }) {
  const { t, tc } = useT();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const [backup, setBackup] = useState<{ title: string; description: string } | null>(null);
  async function run() {
    setBusy(true); setErr(""); setOk("");
    const r = await improveListingText(supabase(), input); setBusy(false);
    if (r.error || !r.data) { setErr(tc(aiWriterMessage(r.error ?? "AI_FAILED"))); return; }
    setBackup({ title: input.title, description: input.description });
    onApply(r.data.optimized_title, r.data.optimized_description);
    setOk(t("ls.ai.done", { n: r.data.remaining }));
  }
  return <div className="stack" style={{ gap: 6 }}>
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      <button type="button" className="secondary" disabled={busy || !canImproveText(input.title, input.description)} onClick={() => void run()}>{busy ? t("ls.ai.working") : t("ls.ai.button")}</button>
      {backup && !busy && <button type="button" className="secondary" onClick={() => { onApply(backup.title, backup.description); setBackup(null); setOk(""); }}>{t("ls.ai.undo")}</button>}
    </div>
    <small>{t("ls.ai.hint")}</small>
    {err && <p className="error" role="alert" style={{ margin: 0 }}>{err}</p>}
    {ok && <p className="ok" role="status" style={{ margin: 0 }}>{ok}</p>}
  </div>;
}
