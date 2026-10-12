import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PALETTES } from "./theme";

// As cores do Site (globals.css) têm de ser as mesmas da paleta partilhada com a APP.
const css = readFileSync(fileURLToPath(new URL("../../../apps/web/app/globals.css", import.meta.url)), "utf8");
const NAMES: Record<string, string> = {
  ink: "fg", white: "bg", muted: "muted", line: "line", surface: "surface", blue: "accent", blueDark: "accent-dark", blueSoft: "accent-soft",
  red: "danger", green: "ok", yellow: "yellow", card: "card", onAccent: "on-accent", inputBorder: "input-border", yellowSoft: "yellow-soft",
  yellowText: "yellow-text", yellowLine: "yellow-line", greenSoft: "green-soft", greenText: "green-text", blueText: "blue-text", goldSoft: "gold-soft",
  goldText: "gold-text", starOn: "star-on", starOff: "star-off", placeholder: "placeholder", logoBlue: "logo-blue", logoRed: "logo-red",
  logoYellow: "logo-yellow", logoGreen: "logo-green"
};
const block = (selector: string) => css.slice(css.indexOf(selector), css.indexOf("}", css.indexOf(selector)));
const full = (h: string) => (h.length === 4 ? "#" + [...h.slice(1)].map(c => c + c).join("") : h).toLowerCase();

describe("cores do Site = cores da APP", () => {
  for (const [mode, selector] of [["light", ":root {"], ["dark", ':root[data-theme="dark"] {']] as const) {
    it(`tema ${mode}`, () => {
      const b = block(selector);
      for (const [key, cssName] of Object.entries(NAMES)) {
        const m = new RegExp(`--${cssName}: (#[0-9a-fA-F]{3,6});`).exec(b);
        expect(m, `--${cssName} em falta no tema ${mode}`).not.toBeNull();
        expect(full(m![1]), `--${cssName} (${mode})`).toBe(full((PALETTES[mode] as Record<string, string>)[key]));
      }
    });
  }
});
