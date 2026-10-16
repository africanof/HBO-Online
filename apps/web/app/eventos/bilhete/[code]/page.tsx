"use client";
import { useParams } from "next/navigation";
import { TicketVerify } from "../../../../components/Events";

export default function VerificarBilhete() {
  const { code } = useParams<{ code: string }>();
  return code ? <TicketVerify code={decodeURIComponent(code)} /> : null;
}
