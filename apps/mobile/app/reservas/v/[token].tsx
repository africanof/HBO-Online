import { useLocalSearchParams } from "expo-router";
import { VenueVerifyScreen } from "../../../components/Venues";

export default function VerificarReserva() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return token ? <VenueVerifyScreen token={token} /> : null;
}
