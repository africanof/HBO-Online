import { useLocalSearchParams } from "expo-router";
import { EventFormScreen } from "../../../components/Events";

export default function EditarEvento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return id ? <EventFormScreen id={id} /> : null;
}
