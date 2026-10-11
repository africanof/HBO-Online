"use client";
import { useEffect, useState } from "react";
import { ListingForm } from "../../../components/ListingForm";
import { currentUserId } from "../../../lib/supabase";

export default function PublicarClassificado() {
  const [user, setUser] = useState<string | null | undefined>(undefined);
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    setWanted(new URLSearchParams(window.location.search).get("finalidade") === "wanted");
    void currentUserId().then(setUser).catch(() => setUser(null));
  }, []);
  return <main>
    <a href="/explorar">← Voltar</a>
    <h1>{wanted ? "🔎 Publicar o que procuro" : "Publicar anúncio"}</h1>
    {!wanted && <p><a href="/classificados/publicar?finalidade=wanted">Quer comprar? Publique o que procura →</a></p>}
    {user === undefined && <p>A carregar…</p>}
    {user === null && <p>Para publicar, <a href={"/conta/login?voltar=/classificados/publicar" + (wanted ? "%3Ffinalidade%3Dwanted" : "")}>inicie sessão</a> ou <a href="/conta/criar">crie uma conta</a>.</p>}
    {user && <ListingForm key={wanted ? "w" : "s"} initialPurpose={wanted ? "wanted" : undefined} />}
  </main>;
}
