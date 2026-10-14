import { useLocalSearchParams } from "expo-router";
import { StationScreen } from "../../../components/Fuel";

export default function Posto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return id ? <StationScreen id={id} /> : null;
}
