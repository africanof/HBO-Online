import { useEffect, useState } from "react";
import { platformCollects } from "@huambo-online/core";
import { supabase } from "./supabase";

/** true quando o Huambo Online recebe todos os pagamentos (pagamento protegido): o vendedor não confirma pagamentos. */
export function usePlatformCollects(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => { void platformCollects(supabase()).then(setOn); }, []);
  return on;
}
