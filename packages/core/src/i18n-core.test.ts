import { it } from "vitest";
import { CORE_TEXT, tc } from "./index";
import fs from "fs";
it("dump", () => {
  const dir = "src/";
  const src = fs.readdirSync(dir).filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.startsWith("i18n")).map(f => fs.readFileSync(dir + f, "utf8")).join("\n");
  const notInSrc = Object.keys(CORE_TEXT).filter(k => !src.includes(JSON.stringify(k)) && !src.includes("'" + k + "'") && !src.includes(k));
  const lines = fs.readFileSync("/tmp/claude-0/-home-user/18f029a6-957e-55e8-a0d1-ce2c16417140/scratchpad/strings.tsv", "utf8").split("\n");
  const missing: string[] = [];
  for (const l of lines) { const [loc, kind, raw] = l.split("\t"); if (kind !== "s") continue; const v = JSON.parse(raw); if (tc(v, "en") === v) missing.push(loc + " " + v); }
  fs.writeFileSync("/tmp/claude-0/-home-user/18f029a6-957e-55e8-a0d1-ce2c16417140/scratchpad/check.txt", "NOT IN SRC:\n" + notInSrc.join("\n") + "\n\nMISSING:\n" + missing.join("\n"));
});
