"use client";
import { useParams } from "next/navigation";
import { StationPage } from "../../../components/Fuel";

export default function Posto() {
  const { id } = useParams<{ id: string }>();
  return id ? <StationPage id={id} /> : null;
}
