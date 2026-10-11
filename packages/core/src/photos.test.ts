import { describe, expect, it } from "vitest";
import { shrinkPlan, jpegName, formatBytes, PHOTO_MAX_SIDE, AVATAR_MAX_SIDE } from "./photos";

describe("fotografias leves", () => {
  it("reduz fotografias grandes mantendo a proporção", () => {
    expect(shrinkPlan(4000, 3000, 3_500_000)).toEqual({ width: PHOTO_MAX_SIDE, height: 1200 });
    expect(shrinkPlan(3000, 4000, 3_500_000)).toEqual({ width: 1200, height: PHOTO_MAX_SIDE });
    expect(shrinkPlan(1200, 1200, 2_000_000, AVATAR_MAX_SIDE)).toEqual({ width: 512, height: 512 });
  });
  it("não mexe em fotografias já pequenas, mas recomprime as pesadas", () => {
    expect(shrinkPlan(800, 600, 120_000)).toBeNull();
    expect(shrinkPlan(1200, 900, 1_500_000)).toEqual({ width: 1200, height: 900 });
    expect(shrinkPlan(0, 0, 10)).toBeNull();
  });
  it("dá nomes e tamanhos legíveis", () => {
    expect(jpegName("IMG_2034.HEIC")).toBe("IMG_2034.jpg");
    expect(jpegName("")).toBe("foto.jpg");
    expect(formatBytes(2_500_000)).toBe("2,4 MB");
    expect(formatBytes(350_000)).toBe("342 KB");
  });
});
