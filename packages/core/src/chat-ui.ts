import { LANG_TAGS, type Lang } from "./i18n";

/**
 * Apresentação das Mensagens (estilo Messenger): horas na lista, separadores «Hoje/Ontem» e balões
 * agrupados (mensagens seguidas da mesma pessoa, com menos de 5 minutos entre elas).
 * As datas usam sempre a hora de Angola.
 */
const TZ = "Africa/Luanda";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ }); // AAAA-MM-DD
function daysBetween(a: Date, b: Date) { return Math.round((Date.parse(dayKey(b)) - Date.parse(dayKey(a))) / 86_400_000); }
const cap = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/** Hora na lista de conversas: «14:05» hoje, «ontem», dia da semana até 6 dias, depois a data curta. */
export function chatListTime(iso: string | null | undefined, lang: Lang, now = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso); if (!Number.isFinite(d.getTime())) return "";
  const tag = LANG_TAGS[lang]; const n = daysBetween(d, now);
  if (n <= 0) return d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  if (n === 1) return new Intl.RelativeTimeFormat(tag, { numeric: "auto" }).format(-1, "day");
  if (n < 7) return d.toLocaleDateString(tag, { weekday: "short", timeZone: TZ });
  return d.toLocaleDateString(tag, { day: "2-digit", month: "2-digit", timeZone: TZ });
}

/** Separador entre dias dentro da conversa: «Hoje», «Ontem», «Segunda-feira, 3 de novembro». */
export function chatDayLabel(iso: string, lang: Lang, now = new Date()): string {
  const d = new Date(iso); const tag = LANG_TAGS[lang]; const n = daysBetween(d, now);
  if (n === 0 || n === 1) return cap(new Intl.RelativeTimeFormat(tag, { numeric: "auto" }).format(-n, "day"));
  return cap(d.toLocaleDateString(tag, { weekday: "long", day: "numeric", month: "long", ...(n > 300 ? { year: "numeric" } : {}), timeZone: TZ }));
}

/** Só a hora («14:05»), para debaixo dos balões. */
export function chatClock(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleTimeString(LANG_TAGS[lang], { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

export type ChatRow<T> = { m: T; mine: boolean; newDay: boolean; first: boolean; last: boolean };
/** Marca cada mensagem: começa um dia novo? É a primeira/última do grupo (mesma pessoa, < 5 min)? */
export function groupChatMessages<T extends { sender_id: string; created_at: string; from_team?: boolean | null }>(msgs: T[], me: string): ChatRow<T>[] {
  const who = (m: T) => (m.from_team ? "team:" : "") + m.sender_id;
  const near = (a: T, b: T) => who(a) === who(b) && dayKey(new Date(a.created_at)) === dayKey(new Date(b.created_at))
    && Math.abs(Date.parse(b.created_at) - Date.parse(a.created_at)) < 5 * 60_000;
  return msgs.map((m, i) => {
    const prev = msgs[i - 1]; const next = msgs[i + 1];
    return { m, mine: m.sender_id === me && !m.from_team, newDay: !prev || dayKey(new Date(prev.created_at)) !== dayKey(new Date(m.created_at)),
      first: !prev || !near(prev, m), last: !next || !near(m, next) };
  });
}

/** Iniciais para o círculo quando não há fotografia («Aires Festo» → «AF»). */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toLocaleUpperCase();
}
/** Cor estável para o círculo de cada pessoa. */
const AVATAR_COLORS = ["#3665F3", "#0B7A3B", "#C7102E", "#B88200", "#7B3FE4", "#0E7C86", "#D2551F", "#5A6472"];
export function avatarColor(seed: string | null | undefined): string {
  let h = 0; for (const c of seed ?? "") h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Assunto a mostrar na conversa: nas conversas com profissionais e empresas o assunto é o nome deles,
 *  por isso mostra-se só o tipo («profissional», «empresa»); nas outras, o título do anúncio/produto. */
export function conversationSubject(x: { subject?: string | null; context_type?: string | null } | null | undefined): string | null {
  if (!x) return null;
  if (["provider", "service", "business"].includes(String(x.context_type))) return null;
  return x.subject?.trim() || null;
}
