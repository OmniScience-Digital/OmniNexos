// src/utils/helper/listUsersHandler.test.ts  (NEW FILE - test)
// Tests the admin user list (amplify/function/listUsers) against a fake Cognito.
import { describe, expect, it } from "vitest";
import { listAllUsers } from "../../../amplify/function/listUsers/handler";

const user = (n: number) => ({
  Username: `user${n}`,
  Attributes: [{ Name: "email", Value: `u${n}@x.co` }],
  Enabled: true,
  UserStatus: "CONFIRMED",
  UserCreateDate: new Date("2026-01-01T00:00:00.000Z"),
  UserLastModifiedDate: new Date("2026-02-01T00:00:00.000Z"),
});

/** A pool of `total` users served 60 per page, like Cognito. */
function fakeCognito(total: number, opts: { failGroupsFor?: string } = {}) {
  const all = Array.from({ length: total }, (_, i) => user(i + 1));
  let inFlight = 0;
  let maxInFlight = 0;
  const calls = { listUsers: 0, groups: 0 };
  return {
    calls,
    get maxInFlight() { return maxInFlight; },
    send: async (cmd: any) => {
      const name = cmd.constructor.name;
      if (name === "ListUsersCommand") {
        calls.listUsers += 1;
        const from = cmd.input.PaginationToken ? Number(cmd.input.PaginationToken) : 0;
        const page = all.slice(from, from + 60);
        return { Users: page, PaginationToken: from + 60 < all.length ? String(from + 60) : undefined };
      }
      if (name === "AdminListGroupsForUserCommand") {
        calls.groups += 1;
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight -= 1;
        if (cmd.input.Username === opts.failGroupsFor) throw new Error("TooManyRequestsException");
        return { Groups: [{ GroupName: "USERS" }, ...(cmd.input.Username === "user1" ? [{ GroupName: "ADMINS" }] : [])] };
      }
      throw new Error(`unexpected ${name}`);
    },
  };
}

describe("listAllUsers", () => {
  it("reads every page: 130 users come back, not just the first 60", async () => {
    const c = fakeCognito(130);
    const users = await listAllUsers(c, "pool1");
    expect(users).toHaveLength(130);
    expect(c.calls.listUsers).toBe(3);
    expect(users[129].Username).toBe("user130");
  });

  it("keeps the same output shape (dates as ISO strings, groups as names)", async () => {
    const [first, second] = await listAllUsers(fakeCognito(2), "pool1");
    expect(first).toEqual({
      Username: "user1",
      Attributes: [{ Name: "email", Value: "u1@x.co" }],
      UserCreateDate: "2026-01-01T00:00:00.000Z",
      UserLastModifiedDate: "2026-02-01T00:00:00.000Z",
      Enabled: true,
      UserStatus: "CONFIRMED",
      Groups: ["USERS", "ADMINS"],
    });
    expect(second.Groups).toEqual(["USERS"]);
  });

  it("looks up groups in small batches, never all at once", async () => {
    const c = fakeCognito(130);
    await listAllUsers(c, "pool1");
    expect(c.calls.groups).toBe(130);
    expect(c.maxInFlight).toBeLessThanOrEqual(10);
  });

  it("a failed group lookup gives that user no groups but does not fail the list", async () => {
    const users = await listAllUsers(fakeCognito(3, { failGroupsFor: "user2" }), "pool1");
    expect(users.map((u) => u.Groups.length)).toEqual([2, 0, 1]);
  });

  it("an empty pool gives an empty list, and a missing pool id is a clear error", async () => {
    expect(await listAllUsers(fakeCognito(0), "pool1")).toEqual([]);
    await expect(listAllUsers(fakeCognito(1), undefined)).rejects.toThrow(/AMPLIFY_AUTH_USERPOOL_ID/);
  });
});