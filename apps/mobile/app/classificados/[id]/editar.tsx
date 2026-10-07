import { useEffect, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { ScrollView, Text } from "react-native";
import { getClassifiedListing, friendlyError } from "@huambo-online/core";
import { ListingForm } from "../../../components/ListingForm";
import { supabase, currentUserId } from "../../../lib/supabase";
import { ui } from "../../../lib/ui";

export default function EditarAnuncio() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={("/classificados/" + id) as any} style={ui.link}>← Voltar ao anúncio</Link>
    <Text style={ui.h1}>Editar anúncio</Text>
    {!!error && <Text style={ui.error}>{error}</Text>}
    {!error && !listing && <Text style={ui.text}>A carregar…</Text>}
    {listing && <ListingForm listing={listing} />}
  </ScrollView>;
}
