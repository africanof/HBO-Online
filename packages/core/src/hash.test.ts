import { describe, expect, it } from "vitest";
import { sha256Hex } from "./hash";

describe("sha256Hex", () => {
  it("dá o mesmo resultado que o padrão SHA-256", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("a".repeat(1000))).toBe("41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
  });
  it("aceita bytes", () => {
    expect(sha256Hex(new Uint8Array([97, 98, 99]))).toBe(sha256Hex("abc"));
    expect(sha256Hex(new Uint8Array([97, 98, 99]).buffer)).toBe(sha256Hex("abc"));
  });
});
