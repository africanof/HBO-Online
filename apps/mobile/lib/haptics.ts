import * as Haptics from "expo-haptics";

/** Vibração leve (ao guardar ♡, enviar e comprar). Nunca falha. */
export function tap() { try { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } catch { /* sem vibração */ } }
export function success() { try { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); } catch { /* sem vibração */ } }
