"use client";
import { useParams } from "next/navigation";
import { VenueVerify } from "../../../../components/Venues";

export default function VerificarQr() {
  const { token } = useParams<{ token: string }>();
  return token ? <VenueVerify token={token} /> : null;
}
