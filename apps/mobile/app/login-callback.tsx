import { useEffect } from "react";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { ui } from "../lib/ui";
import { useT } from "../lib/i18n";

/** Regresso do Google / Facebook / Apple: a sessão já foi guardada no ecrã «Entrar»; aqui só se volta ao início. */
export default function LoginCallback() {
  const { t } = useT();
  useEffect(() => { const id = setTimeout(() => router.replace("/"), 600); return () => clearTimeout(id); }, []);
  return <View style={[ui.screen, { flex: 1, alignItems: "center", justifyContent: "center" }]}><Text style={ui.text}>{t("social.finishing")}</Text></View>;
}
