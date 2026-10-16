import { useLocalSearchParams } from "expo-router";
import { VenueScreen } from "../../../components/Venues";

export default function Estabelecimento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return id ? <VenueScreen id={id} /> : null;
}
