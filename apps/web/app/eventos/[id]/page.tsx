"use client";
import { useParams } from "next/navigation";
import { EventDetail } from "../../../components/Events";

export default function Evento() {
  const { id } = useParams<{ id: string }>();
  return id ? <EventDetail id={id} /> : null;
}
