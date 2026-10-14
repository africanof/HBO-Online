"use client";
import { useParams } from "next/navigation";
import { StationForm } from "../../../../components/Fuel";

export default function EditarPosto() {
  const { id } = useParams<{ id: string }>();
  return id ? <StationForm id={id} /> : null;
}
