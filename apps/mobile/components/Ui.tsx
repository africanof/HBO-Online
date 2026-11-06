import { Pressable, ScrollView, Text, View } from "react-native";
import { ui } from "../lib/ui";

export function Button({ title, onPress, disabled, variant = "primary" }: { title: string; onPress: () => void; disabled?: boolean; variant?: "primary" | "secondary" | "danger" }) {
  const style = variant === "secondary" ? ui.buttonSecondary : variant === "danger" ? ui.danger : ui.button;
  const textStyle = variant === "secondary" ? ui.buttonSecondaryText : ui.buttonText;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [style, { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
    <Text style={[textStyle, { textAlign: "center" }]}>{title}</Text>
  </Pressable>;
}

export function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T | ""; onChange: (v: T) => void }) {
  return <View style={ui.row}>{options.map(o => {
    const on = o.value === value;
    return <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o.value)} style={on ? ui.chipOn : ui.chip}>
      <Text style={on ? ui.chipTextOn : ui.chipText}>{o.label}</Text>
    </Pressable>;
  })}</View>;
}

export function Message({ error, ok }: { error?: string; ok?: string }) {
  return <>{!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}{!!ok && <Text style={ui.ok}>{ok}</Text>}</>;
}

/** Botão pequeno para ações lado a lado (duas por linha), como nas APPs dos grandes marketplaces. */
export function SmallButton({ title, onPress, disabled, primary }: { title: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [primary ? ui.button : ui.buttonSecondary, { flexGrow: 1, flexBasis: "45%", minHeight: 44, paddingVertical: 8, paddingHorizontal: 10, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
    <Text style={[primary ? ui.buttonText : ui.buttonSecondaryText, { textAlign: "center", fontSize: 14 }]} numberOfLines={2}>{title}</Text>
  </Pressable>;
}

/** «Ordenar» numa linha que desliza para o lado. */
export function SortChips<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: "center" }}>
    <Text style={[ui.muted, { fontWeight: "700" }]}>{label}</Text>
    <Chips options={options} value={value} onChange={onChange} />
  </ScrollView>;
}
