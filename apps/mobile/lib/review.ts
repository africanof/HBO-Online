import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import { REVIEW_PROMPT_KEY, shouldAskForReview } from "@huambo-online/core";

/** Depois de um bom momento (compra recebida), pede uma avaliação na Play Store — no máximo a cada 120 dias. */
export async function askForReviewAfterGoodMoment() {
  try {
    const raw = await AsyncStorage.getItem(REVIEW_PROMPT_KEY);
    const last = raw ? Number(raw) : null;
    if (!shouldAskForReview(Number.isFinite(last) ? last : null, 1)) return;
    if (!(await StoreReview.isAvailableAsync())) return;
    await AsyncStorage.setItem(REVIEW_PROMPT_KEY, String(Date.now()));
    setTimeout(() => { void StoreReview.requestReview().catch(() => {}); }, 1500);
  } catch { /* opcional */ }
}
