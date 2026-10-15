// src/utils/helper/telegramGroup.test.ts  (NEW FILE - test)
import { describe, expect, it } from "vitest";
import { normalizeChatId, validateGroupInput } from "./telegramGroup";

describe("telegram group input", () => {
  it("accepts group and supergroup chat ids", () => {
    expect(normalizeChatId("-987654321")).toBe("-987654321");
    expect(normalizeChatId(" -1001234567890 ")).toBe("-1001234567890");
    expect(normalizeChatId("-100 1234 567890")).toBe("-1001234567890");
  });
  it("rejects things that are not chat ids", () => {
    for (const bad of ["", "abc", "@mygroup", "-", "12", "1.5", "-100123456789012345678901"]) {
      expect(normalizeChatId(bad)).toBeNull();
    }
  });
  it("needs a name and a valid id, and tidies both", () => {
    expect(validateGroupInput({ groupName: "  Klipfontein   JC  ", chatId: "-1001234567890" }))
      .toEqual({ ok: true, value: { groupName: "Klipfontein JC", chatId: "-1001234567890" } });
    expect(validateGroupInput({ groupName: "  ", chatId: "-1001234567890" })).toMatchObject({ ok: false });
    expect(validateGroupInput({ groupName: "A", chatId: "nope" })).toMatchObject({ ok: false });
    expect(validateGroupInput({ groupName: "x".repeat(101), chatId: "-1001234567890" })).toMatchObject({ ok: false });
  });
});

describe("telegram group row id", () => {
  it("is derived from the chat id (same rule as the backend bot capture)", async () => {
    const { telegramGroupId } = await import("./telegramGroup");
    expect(telegramGroupId("-1001234567890")).toBe("tg-1001234567890");
  });
});