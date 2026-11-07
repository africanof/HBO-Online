import { Component, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { reportError } from "../lib/health";
import { C } from "../lib/ui";

/** Se um ecrã falhar, mostra «Tentar outra vez» em vez de fechar a APP, e avisa a equipa. */
export class ErrorBoundary extends Component<{ children: ReactNode; labels: { title: string; text: string; retry: string } }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { reportError(e, true); }
  render() {
    if (!this.state.failed) return this.props.children;
    const l = this.props.labels;
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12, backgroundColor: C.white }}>
      <Text style={{ fontSize: 48 }}>😕</Text>
      <Text style={{ fontSize: 22, fontWeight: "800", color: C.ink, textAlign: "center" }}>{l.title}</Text>
      <Text style={{ fontSize: 16, color: C.muted, textAlign: "center" }}>{l.text}</Text>
      <Pressable accessibilityRole="button" onPress={() => this.setState({ failed: false })} style={{ backgroundColor: C.blue, borderRadius: 999, paddingHorizontal: 24, minHeight: 50, justifyContent: "center" }}>
        <Text style={{ color: C.onAccent, fontWeight: "800", fontSize: 17 }}>{l.retry}</Text>
      </Pressable>
    </View>;
  }
}
