import { useLocalSearchParams } from "expo-router";
import { FuelVerifyScreen } from "../../../components/Fuel";

export default function VerificarQr() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return token ? <FuelVerifyScreen token={token} /> : null;
}
