import { useEffect, useState, type ReactNode } from "react";
import { Text } from "react-native";
import { timeLeftLive } from "@huambo-online/core";
import { useT } from "../lib/i18n";

/** Tempo que falta, a contar ao segundo (como no eBay). Fica vermelho na última hora. */
export function Countdown({ endsAt, onEnd }: { endsAt: string; onEnd?: () => void }) {
  const { tc } = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const r = timeLeftLive(endsAt, now);
  useEffect(() => { if (r.ended) onEnd?.(); }, [r.ended]);
  return <Text accessibilityRole="timer" style={{ fontWeight: "800", color: r.urgent ? "#d32f2f" : undefined, fontVariant: ["tabular-nums"] }}>{tc(r.text)}</Text>;
}

/** Põe um elemento no lugar de {time} num texto traduzido (ex.: «termina em {time}»). */
export function withSlot(text: string, slot: ReactNode): ReactNode {
  const [a, b = ""] = text.split("\u0000");
  return <>{a}{slot}{b}</>;
}
