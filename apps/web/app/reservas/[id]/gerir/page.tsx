"use client";
import { useParams } from "next/navigation";
import { VenueManage } from "../../../../components/Venues";

export default function GerirEstabelecimento() {
  const { id } = useParams<{ id: string }>();
  return id ? <VenueManage id={id} /> : null;
}
