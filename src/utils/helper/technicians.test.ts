// src/utils/helper/technicians.test.ts  (NEW FILE - test)
// Tests the pure mapper behind the technician picker (amplify/function/listTechnicians).
import { describe, expect, it } from "vitest";
import { toTechnicians, type CognitoUserLike } from "../../../amplify/function/listTechnicians/technicians";

const user = (over: Partial<CognitoUserLike> & { sub?: string; name?: string; email?: string; pref?: string }): CognitoUserLike => ({
  Username: over.Username ?? "u",
  Enabled: over.Enabled,
  UserStatus: over.UserStatus ?? "CONFIRMED",
  Attributes: [
    ...(over.sub ? [{ Name: "sub", Value: over.sub }] : []),
    ...(over.pref ? [{ Name: "preferred_username", Value: over.pref }] : []),
    ...(over.name ? [{ Name: "name", Value: over.name }] : []),
    ...(over.email ? [{ Name: "email", Value: over.email }] : []),
  ],
});

describe("toTechnicians", () => {
  it("returns id, name and email only, sorted by name, using preferred_username first", () => {
    const out = toTechnicians([
      user({ sub: "b", pref: "Ben Mokoena", email: "ben@x.co" }),
      user({ sub: "a", pref: "ayanda dlamini", email: "ayanda@x.co" }),
    ]);
    expect(out).toEqual([
      { id: "a", name: "ayanda dlamini", email: "ayanda@x.co" },
      { id: "b", name: "Ben Mokoena", email: "ben@x.co" },
    ]);
  });
  it("falls back to name, then email, then username", () => {
    expect(toTechnicians([user({ sub: "1", name: "Only Name" })])[0].name).toBe("Only Name");
    expect(toTechnicians([user({ sub: "2", email: "e@x.co" })])[0].name).toBe("e@x.co");
    expect(toTechnicians([user({ sub: "3", Username: "login3" })])[0].name).toBe("login3");
  });
  it("leaves out disabled, archived and compromised accounts and users without a sub", () => {
    const out = toTechnicians([
      user({ sub: "ok", pref: "Ok" }),
      user({ sub: "off", pref: "Off", Enabled: false }),
      user({ sub: "arch", pref: "Arch", UserStatus: "ARCHIVED" }),
      user({ sub: "comp", pref: "Comp", UserStatus: "COMPROMISED" }),
      user({ pref: "No Sub" }),
    ]);
    expect(out.map((t) => t.id)).toEqual(["ok"]);
  });
  it("keeps invited users who have not signed in yet, and never repeats a user", () => {
    const out = toTechnicians([
      user({ sub: "new", pref: "New Hire", UserStatus: "FORCE_CHANGE_PASSWORD" }),
      user({ sub: "new", pref: "New Hire" }),
    ]);
    expect(out).toHaveLength(1);
  });
});