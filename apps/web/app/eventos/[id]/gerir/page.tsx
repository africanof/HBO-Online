"use client";
import { useParams } from "next/navigation";
import { EventManage } from "../../../../components/Events";

export default function GerirEvento() {
  const { id } = useParams<{ id: string }>();
  return id ? <EventManage id={id} /> : null;
}
