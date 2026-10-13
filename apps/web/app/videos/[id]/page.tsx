"use client";
import { useParams } from "next/navigation";
import { PromoDetail } from "../../../components/Promo";

export default function Video() {
  const { id } = useParams<{ id: string }>();
  return id ? <PromoDetail id={id} /> : null;
}
