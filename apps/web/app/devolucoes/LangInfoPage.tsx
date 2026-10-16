"use client";
import { returnsPage, deleteAccountPage } from "@huambo-online/core";
import { InfoPageView } from "../../components/InfoPage";
import { useT } from "../../lib/i18n";
import { returnsPageIn, deleteAccountPageIn } from "../../lib/i18n/shop";

/** Devoluções / Apagar conta na língua escolhida (português vem do core; inglês e mandarim do dicionário da Loja). */
export function LangInfoPage({ which, email }: { which: "returns" | "delete"; email?: string | null }) {
  const { lang } = useT();
  const page = which === "returns"
    ? (lang === "pt" ? returnsPage(email) : returnsPageIn(lang, email))
    : (lang === "pt" ? deleteAccountPage(email) : deleteAccountPageIn(lang, email));
  return <InfoPageView page={page} />;
}
