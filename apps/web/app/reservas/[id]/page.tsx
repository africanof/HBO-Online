"use client";
import { useParams } from "next/navigation";
import { VenuePage } from "../../../components/Venues";

export default function Estabelecimento() {
  const { id } = useParams<{ id: string }>();
  return id ? <VenuePage id={id} /> : null;
}
