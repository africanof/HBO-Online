import { it } from "vitest";
import * as core from "./index";
import fs from "fs";
it("dump", () => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(core)) {
    if (typeof v === "function" || v instanceof RegExp) continue;
    out[k] = v;
  }
  fs.writeFileSync("/tmp/claude-0/-home-user/18f029a6-957e-55e8-a0d1-ce2c16417140/scratchpad/exports.json", JSON.stringify(out, null, 1));
});
