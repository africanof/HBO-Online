import { useLocalSearchParams } from "expo-router";
import { EventManageScreen } from "../../../components/Events";

export default function GerirEvento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return id ? <EventManageScreen id={id} /> : null;
}
