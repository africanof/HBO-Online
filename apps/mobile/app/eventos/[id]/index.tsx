import { useLocalSearchParams } from "expo-router";
import { EventDetailScreen } from "../../../components/Events";

export default function Evento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return id ? <EventDetailScreen id={id} /> : null;
}
