import { useLocalSearchParams } from "expo-router";
import { VenueListScreen } from "../../components/Venues";

export default function Reservas() {
  const { tipo } = useLocalSearchParams<{ tipo?: string }>();
  return <VenueListScreen tipo={tipo} />;
}
