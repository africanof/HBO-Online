import { useLocalSearchParams } from "expo-router";
import { DirectoryDetail } from "../../components/Directory";
export default function Profissional() { const { id } = useLocalSearchParams<{ id: string }>(); return <DirectoryDetail kind="providers" id={id} />; }
