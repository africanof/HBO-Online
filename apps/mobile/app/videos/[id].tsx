import { useLocalSearchParams } from "expo-router";
import { PromoDetailScreen } from "../../components/Promo";

export default function Video() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return id ? <PromoDetailScreen id={id} /> : null;
}
