import { useLocalSearchParams } from "expo-router";
import { TicketVerifyScreen } from "../../../components/Events";

export default function VerificarBilhete() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return code ? <TicketVerifyScreen code={code} /> : null;
}
