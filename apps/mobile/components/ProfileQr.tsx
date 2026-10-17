import { useState } from "react";
import { Linking, Modal, ScrollView, Share, Text, View, useWindowDimensions } from "react-native";
import { profileUrl, profileQrPngUrl, profileShareText, PROFILE_QR_LABELS, type ProfileQrKind } from "@huambo-online/core";
import { siteUrl } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Button, Message } from "./Ui";
import { QrView } from "./Mfa";
import { useT } from "../lib/i18n";

/**
 * 📱 Código QR do perfil (profissional, empresa, loja, estabelecimento, posto, praça).
 * O QR leva à página pública; quem tem a APP abre na APP, quem não tem abre no site.
 * Partilhar (Share), baixar a imagem PNG (gerada pelo site, abre no navegador) e mostrar a ligação para copiar.
 */
export function ProfileQr({ kind, id, name, hint }: { kind: ProfileQrKind; id: string; name: string; hint?: string }) {
  const { t, tc } = useT();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false); const [error, setError] = useState("");
  const url = profileUrl(siteUrl, kind, id);
  const title = name.trim() || tc(PROFILE_QR_LABELS[kind]);
  const size = Math.max(200, Math.min(width - 64, 340));

  async function share() {
    setError("");
    try { await Share.share({ message: tc(profileShareText(title, url)), url }); } catch { setError(t("sv.qr.share_fail")); }
  }
  async function download() {
    setError("");
    try { await Linking.openURL(profileQrPngUrl(siteUrl, kind, id) + "&download=1"); } catch { setError(t("sv.qr.open_fail")); }
  }

  return <>
    <Button title={t("sv.qr.button")} variant="secondary" onPress={() => { setError(""); setOpen(true); }} />
    {!!hint && <Text style={ui.muted}>{hint}</Text>}
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      {open && <ScrollView contentContainerStyle={[ui.screen, { backgroundColor: C.white }]}>
        <Text style={ui.h1}>{t("sv.qr.title")}</Text>
        <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 8, alignSelf: "center" }}>
          <QrView text={url} size={size} quiet={4} label={t("sv.qr.a11y", { name: title })} />
        </View>
        <Text style={[ui.h2, { textAlign: "center" }]}>{title}</Text>
        <Text style={[ui.muted, { textAlign: "center" }]}>{tc(PROFILE_QR_LABELS[kind])}</Text>
        <Text style={[ui.label, { textAlign: "center" }]}>{t("sv.qr.read")}</Text>
        <Text style={ui.text}>{t("sv.qr.explain")}</Text>
        <Button title={t("sv.qr.share")} onPress={() => void share()} />
        <Button title={t("sv.qr.download")} variant="secondary" onPress={() => void download()} />
        <Text style={ui.muted}>{t("sv.qr.download_hint")}</Text>
        <View style={ui.card}>
          <Text style={ui.label}>{t("sv.qr.link")}</Text>
          <Text selectable style={[ui.text, { color: C.blue }]}>{url}</Text>
          <Text style={ui.muted}>{t("sv.qr.copy_hint")}</Text>
        </View>
        <Message error={error} />
        <Button title={t("common.close")} variant="secondary" onPress={() => setOpen(false)} />
      </ScrollView>}
    </Modal>
  </>;
}
