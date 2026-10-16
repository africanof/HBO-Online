import { describe, expect, it } from "vitest";
import { parseSha256Fingerprints, assetLinks, APP_LINK_PATHS, ANDROID_PACKAGE } from "./app-links";
import { readFileSync } from "node:fs";

const fp = "AB:".repeat(31) + "AB";
describe("App Links", () => {
  it("lê as impressões digitais", () => {
    expect(parseSha256Fingerprints(fp.toLowerCase())).toEqual([fp]);
    expect(parseSha256Fingerprints(fp.replace(/:/g, "") + " , " + fp)).toEqual([fp]);
    expect(parseSha256Fingerprints("curto, " + "CD".repeat(32))).toEqual(["CD:".repeat(31) + "CD"]);
    expect(parseSha256Fingerprints(undefined)).toEqual([]);
  });
  it("monta o assetlinks.json", () => {
    expect(assetLinks([])).toEqual([]);
    expect(assetLinks([fp])[0].target).toEqual({ namespace: "android_app", package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: [fp] });
  });
  it("app.json abre na APP os mesmos caminhos", () => {
    const app = JSON.parse(readFileSync(new URL("../../../apps/mobile/app.json", import.meta.url), "utf8")).expo;
    expect(app.android.package).toBe(ANDROID_PACKAGE);
    const f = app.android.intentFilters[0];
    expect(f.autoVerify).toBe(true);
    expect(f.data.map((d: any) => d.pathPrefix)).toEqual([...APP_LINK_PATHS]);
    expect(new Set(f.data.map((d: any) => d.host))).toEqual(new Set(["huambo-na-m-o.onrender.com"]));
  });
});
