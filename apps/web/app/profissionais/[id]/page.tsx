"use client";
import { useParams } from "next/navigation";
import { DirectoryDetail } from "../../../components/Directory";
export default function Profissional() { const { id } = useParams<{ id: string }>(); return <DirectoryDetail kind="providers" id={id} />; }
