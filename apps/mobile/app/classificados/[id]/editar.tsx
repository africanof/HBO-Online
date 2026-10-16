import { useEffect, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { ScrollView, Text } from "react-native";
import { getClassifiedListing, friendlyErrorIn } from "@huambo-online/core";
import { ListingForm } from "../../../components/ListingForm";
import { supabase, currentUserId } from "../../../lib/supabase";
import { ui } from "../../../lib/ui";
import { useT } from "../../../lib/i18n";

export default function EditarAnuncio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<any>(null);
  const [error, setError] = useState(""); const { t, lang } = useT();
  useEffect(() => {
    if (!id) return;
    void (async () => {
      const uid = await currentUserId();
      if (!uid) { setError(t("ls.edit.sign_in")); return; }
      const r = await getClassifiedListing(supabase(), id);
      if (r.error) setError(friendlyErrorIn(r.error, lang));
      else if (!r.data || r.data.owner_id !== uid) setError(t("ls.edit.owner_only"));
      else setListing(r.data);
    })();
  }, [id]);
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={("/classificados/" + id) as any} style={ui.link}>{t("ls.edit.back")}</Link>
    <Text style={ui.h1}>{t("ls.edit.title")}</Text>
    {!!error && <Text style={ui.error}>{error}</Text>}
    {!error && !listing && <Text style={ui.text}>{t("common.loading")}</Text>}
    {listing && <ListingForm listing={listing} />}
  </ScrollView>;
}
