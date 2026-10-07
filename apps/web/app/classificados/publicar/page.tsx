"use client";
import { useEffect, useState } from "react";
import { ListingForm } from "../../../components/ListingForm";
import { currentUserId } from "../../../lib/supabase";

export default function PublicarClassificado() {
  const [user, setUser] = useState<string | null | undefined>(undefined);
  useEffect(() => { void currentUserId().then(setUser).catch(() => setUser(null)); }, []);
  return <main>
    <a href="/explorar">← Voltar</a>
    <h1>Publicar anúncio</h1>
    {user === undefined && <p>A carregar…</p>}
    {user === null && <p>Para publicar, <a href="/conta/login?voltar=/classificados/publicar">inicie sessão</a> ou <a href="/conta/criar">crie uma conta</a>.</p>}
    {user && <ListingForm />}
  </main>;
}
