import { useLocalSearchParams } from "expo-router";
import { StationFormScreen } from "../../../components/Fuel";

export default function EditarPosto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return id ? <StationFormScreen id={id} /> : null;
}
