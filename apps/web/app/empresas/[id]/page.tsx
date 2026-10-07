"use client";
import { useParams } from "next/navigation";
import { DirectoryDetail } from "../../../components/Directory";
export default function Empresa() { const { id } = useParams<{ id: string }>(); return <DirectoryDetail kind="businesses" id={id} />; }
