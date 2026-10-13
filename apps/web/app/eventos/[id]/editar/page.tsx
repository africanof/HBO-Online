"use client";
import { useParams } from "next/navigation";
import { EventForm } from "../../../../components/Events";

export default function EditarEvento() {
  const { id } = useParams<{ id: string }>();
  return id ? <EventForm id={id} /> : null;
}
