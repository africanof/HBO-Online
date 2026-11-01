import { describe, expect, it } from "vitest";
import { parseSha256Fingerprints, assetLinks, appLinkFingerprints, ANDROID_SHA256_FINGERPRINT, APP_LINK_PATHS, ANDROID_PACKAGE } from "./app-links";
import { readFileSync } from "node:fs";

const fp = "AB:".repeat(31) + "AB";
describe("App Links", () => {
  it("lê as impressões digitais", () => {
    expect(parseSha256Fingerprints(fp.toLowerCase())).toEqual([fp]);
    expect(parseSha256Fingerprints(fp.replace(/:/g, "") + " , " + fp)).toEqual([fp]);
    expect(parseSha256Fingerprints("curto, " + "CD".repeat(32))).toEqual(["CD:".repeat(31) + "CD"]);
    expect(parseSha256Fingerprints(undefined)).toEqual([]);
  });
  it("usa sempre a impressão digital da APP", () => {
    const app = parseSha256Fingerprints(ANDROID_SHA256_FINGERPRINT);
    expect(app[0]).toBe("EB:06:4E:D7:BB:66:AF:80:93:CC:B2:4F:72:AA:A9:40:52:51:1E:42:D5:F2:B9:E3:33:37:3D:78:00:66:BA:6C");
    expect(appLinkFingerprints(undefined)).toEqual(app);
    expect(appLinkFingerprints(fp)).toEqual([fp, app[0]]);
    expect(appLinkFingerprints(ANDROID_SHA256_FINGERPRINT.toUpperCase())).toEqual(app);
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
    expect(new Set(f.data.map((d: any) => d.host))).toEqual(new Set(["huambo-online.vercel.app"]));
  });
});
