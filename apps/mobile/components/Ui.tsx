import { Pressable, Text, View } from "react-native";
import { ui } from "../lib/ui";

export function Button({ title, onPress, disabled, variant = "primary" }: { title: string; onPress: () => void; disabled?: boolean; variant?: "primary" | "secondary" | "danger" }) {
  const style = variant === "secondary" ? ui.buttonSecondary : variant === "danger" ? ui.danger : ui.button;
  const textStyle = variant === "secondary" ? ui.buttonSecondaryText : ui.buttonText;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [style, { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
    <Text style={textStyle}>{title}</Text>
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
