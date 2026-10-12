import { describe, expect, it } from "vitest";
import { PALETTES, resolveTheme, readThemePreference, logoParts, contrastRatio, THEME_OPTIONS } from "./theme";

describe("modo escuro", () => {
  it("escolhe o tema", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
    expect(readThemePreference("xpto")).toBe("system");
    expect(THEME_OPTIONS.map(o => o.value)).toEqual(["system", "light", "dark"]);
  });
  it("as duas paletas têm as mesmas cores", () => {
    expect(Object.keys(PALETTES.dark).sort()).toEqual(Object.keys(PALETTES.light).sort());
  });
  for (const mode of ["light", "dark"] as const) {
    it(`texto legível no tema ${mode === "light" ? "claro" : "escuro"}`, () => {
      const p = PALETTES[mode];
      const pairs: [string, string, number][] = [
        [p.ink, p.white, 4.5], [p.ink, p.card, 4.5], [p.ink, p.surface, 4.5], [p.muted, p.white, 4.5], [p.muted, p.surface, 4.5],
        [p.blue, p.white, 4.5], [p.blue, p.card, 4.5], [p.onAccent, p.blue, 4.5], [p.red, p.white, 4.5], [p.green, p.white, 4.5],
        [p.yellowText, p.yellowSoft, 4.5], [p.greenText, p.greenSoft, 4.5], [p.blueText, p.blueSoft, 4.5], [p.goldText, p.goldSoft, 4.5],
        [p.inputBorder, p.white, 3], [p.starOn, p.white, 3]
      ];
      for (const [fg, bg, min] of pairs) expect(contrastRatio(fg, bg), `${fg} sobre ${bg}`).toBeGreaterThanOrEqual(min);
      for (const [, color] of logoParts(mode)) expect(contrastRatio(color, p.white)).toBeGreaterThanOrEqual(3);
    });
  }
});
