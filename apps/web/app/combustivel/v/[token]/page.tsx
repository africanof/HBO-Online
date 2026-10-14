"use client";
import { useParams } from "next/navigation";
import { FuelVerify } from "../../../../components/Fuel";

export default function VerificarQr() {
  const { token } = useParams<{ token: string }>();
  return token ? <FuelVerify token={token} /> : null;
}
