import { claimPendingReferral } from "@huambo-online/core";
import { supabase } from "./supabase";
import { deviceStore } from "../components/Engage";

/** Usa o código de convite guardado (no registo) quando a pessoa entra. Devolve a função para parar. */
export function startReferralClaim(): () => void {
  void supabase().auth.getSession().then(({ data }) => { if (data.session) void claimPendingReferral(supabase(), deviceStore); }).catch(() => {});
  const { data } = supabase().auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session) void claimPendingReferral(supabase(), deviceStore);
  });
  return () => data.subscription.unsubscribe();
}
