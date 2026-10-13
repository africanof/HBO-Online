"use client";
import { useEffect } from "react";
import { storeReferralCode, claimPendingReferral } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { browserStore } from "./Engage";

/** Guarda «?convite=CÓDIGO» da ligação e usa-o quando a pessoa tiver sessão (uma só vez). */
export function ReferralCapture() {
  useEffect(() => {
    void (async () => {
      try {
        const code = new URLSearchParams(window.location.search).get("convite");
        if (code) await storeReferralCode(browserStore, code);
        const { data } = await supabase().auth.getSession();
        if (data.session) await claimPendingReferral(supabase(), browserStore);
      } catch { /* opcional */ }
    })();
    const { data: sub } = supabase().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) void claimPendingReferral(supabase(), browserStore);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return null;
}
