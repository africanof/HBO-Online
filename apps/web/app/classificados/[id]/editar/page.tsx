"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getClassifiedListing, friendlyError } from "@huambo-online/core";
import { ListingForm } from "../../../../components/ListingForm";
import { supabase, currentUserId } from "../../../../lib/supabase";

export default function EditarAnuncio() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!id) return;
    void (async () => {
      const uid = await currentUserId();
      if (!uid) { setError("Inicie sessão para editar."); return; }
      const r = await getClassifiedListing(supabase(), id);
      if (r.error) setError(friendlyError(r.error));
      else if (!r.data || r.data.owner_id !== uid) setError("Só o dono do anúncio pode editá-lo.");
      else setListing(r.data);
    })();
  }, [id]);
  return <main>
    <a href={"/classificados/" + id}>← Voltar ao anúncio</a>
    <h1>Editar anúncio</h1>
    {error && <p className="error">{error}</p>}
    {!error && !listing && <p>A carregar…</p>}
    {listing && <ListingForm listing={listing} />}
  </main>;
}
