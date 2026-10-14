"use client";
import { useParams } from "next/navigation";
import { StationManage } from "../../../../components/Fuel";

export default function GerirPosto() {
  const { id } = useParams<{ id: string }>();
  return id ? <StationManage id={id} /> : null;
}
