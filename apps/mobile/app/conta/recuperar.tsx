import { useState } from "react";
import { useRouter } from "expo-router";
import { ScrollView, Text, TextInput } from "react-native";
import { changeCurrentUserPassword, friendlyError } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { ui } from "../../lib/ui";
import { Button, Message } from "../../components/Ui";
import { useT } from "../../lib/i18n";

export default function Recuperar() {
  const router = useRouter(); const { t } = useT();
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [error, setError] = useState(""); const [ok, setOk] = useState(""); const [saving, setSaving] = useState(false);
  async function save() {
    setError(""); setSaving(true);
    const r = await changeCurrentUserPassword(supabase(), pw, pw2);
    setSaving(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    setOk(t("recover.done")); setTimeout(() => router.replace("/login"), 700);
  }
  return <ScrollView contentContainerStyle={ui.screen}>
    <Text style={ui.h1}>{t("recover.title")}</Text>
    <Text style={ui.label}>{t("recover.title")}</Text><TextInput accessibilityLabel={t("recover.title")} style={ui.input} secureTextEntry value={pw} onChangeText={setPw} />
    <Text style={ui.label}>{t("auth.password_confirm")}</Text><TextInput accessibilityLabel={t("auth.password_confirm")} style={ui.input} secureTextEntry value={pw2} onChangeText={setPw2} />
    <Button title={saving ? t("recover.saving") : t("recover.set")} disabled={saving} onPress={() => void save()} />
    <Message error={error} ok={ok} />
  </ScrollView>;
}
