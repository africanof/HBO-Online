import { useLocalSearchParams } from "expo-router";
import { DirectoryDetail } from "../../components/Directory";
export default function Empresa() { const { id } = useLocalSearchParams<{ id: string }>(); return <DirectoryDetail kind="businesses" id={id} />; }
