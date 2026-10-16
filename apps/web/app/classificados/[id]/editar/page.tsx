"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getClassifiedListing, friendlyErrorIn } from "@huambo-online/core";
import { ListingForm } from "../../../../components/ListingForm";
import { supabase, currentUserId } from "../../../../lib/supabase";
import { useT } from "../../../../lib/i18n";

export default function EditarAnuncio() {
  const { id } = useParams<{ id: string }>();
  const { lang, t } = useT();
  const [listing, setListing] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!id) return;
    void (async () => {
      const uid = await currentUserId();
      if (!uid) { setError(t("ls.login_to_edit")); return; }
      const r = await getClassifiedListing(supabase(), id);
      if (r.error) setError(friendlyErrorIn(r.error, lang));
      else if (!r.data || r.data.owner_id !== uid) setError(t("ls.only_owner_edit"));
      else setListing(r.data);
    })();
  }, [id]);
  return <main>
    <a href={"/classificados/" + id}>← {t("ls.back_to_listing")}</a>
    <h1>{t("ls.edit_listing")}</h1>
    {error && <p className="error">{error}</p>}
    {!error && !listing && <p>{t("common.loading")}</p>}
    {listing && <ListingForm listing={listing} />}
  </main>;
}
