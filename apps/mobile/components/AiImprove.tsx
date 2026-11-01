import { useState } from "react";
import { Text, View } from "react-native";
import { improveListingText, aiWriterMessage, canImproveText, type AiWriterInput } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";
import { ui } from "../lib/ui";
import { Button, Message } from "./Ui";

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
  return <View style={{ gap: 6 }}>
    <Button title={busy ? t("ls.ai.working") : t("ls.ai.button")} variant="secondary" disabled={busy || !canImproveText(input.title, input.description)} onPress={() => void run()} />
    {backup && !busy && <Button title={t("ls.ai.undo")} variant="secondary" onPress={() => { onApply(backup.title, backup.description); setBackup(null); setOk(""); }} />}
    <Text style={ui.muted}>{t("ls.ai.hint")}</Text>
    <Message error={err} ok={ok} />
  </View>;
}
