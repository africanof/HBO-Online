import { useLocalSearchParams } from "expo-router";
import { StationManageScreen } from "../../../components/Fuel";

export default function GerirPosto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return id ? <StationManageScreen id={id} /> : null;
}
