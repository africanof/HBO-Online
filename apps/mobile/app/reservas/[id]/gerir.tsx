import { useLocalSearchParams } from "expo-router";
import { VenueManageScreen } from "../../../components/Venues";

export default function GerirEstabelecimento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return id ? <VenueManageScreen id={id} /> : null;
}
