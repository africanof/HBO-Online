"use client";
import { useEffect, useState } from "react";
import { ListingForm } from "../../../components/ListingForm";
import { currentUserId } from "../../../lib/supabase";
import { useT } from "../../../lib/i18n";

export default function PublicarClassificado() {
  const { t } = useT();
  const [user, setUser] = useState<string | null | undefined>(undefined);
  const [wanted, setWanted] = useState(false); const [mode, setMode] = useState(""); const [cat, setCat] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setWanted(params.get("finalidade") === "wanted"); setMode(params.get("modo") ?? ""); setCat((params.get("categoria") ?? "").toLowerCase().replace(/[^a-z0-9-]/g, ""));
    void currentUserId().then(setUser).catch(() => setUser(null));
  }, []);
  return <main>
    <a href="/explorar">← {t("common.back")}</a>
    <h1>{wanted ? "🔎 " + t("ft.post_wanted") : t("ls.publish_listing")}</h1>
    {!wanted && <p><a href="/classificados/publicar?finalidade=wanted">{t("ls.want_buy_post")} →</a></p>}
    {user === undefined && <p>{t("common.loading")}</p>}
    {user === null && <p>{t("ls.to_publish")} <a href={"/conta/login?voltar=/classificados/publicar" + (wanted ? "%3Ffinalidade%3Dwanted" : "")}>{t("ls.sign_in_lc")}</a> {t("ls.or")} <a href="/conta/criar">{t("ls.create_account_lc")}</a>.</p>}
    {user && <ListingForm key={(wanted ? "w" : "s") + mode + cat} initialPurpose={wanted ? "wanted" : undefined} initialSaleMode={mode} initialCategorySlug={cat || undefined} />}
  </main>;
}
