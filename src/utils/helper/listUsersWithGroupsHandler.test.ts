// src/utils/helper/listUsersWithGroupsHandler.test.ts  (NEW FILE - test)
// Tests amplify/function/admin/list-users-with-groups against a fake Cognito.
import { describe, expect, it } from "vitest";
import { handler, listAllGroupsWithUsers } from "../../../amplify/function/admin/list-users-with-groups/handler";

/** `groups` maps group name -> number of users; everything is served 60 per page like Cognito. */
function fakeCognito(groups: Record<string, number>) {
  const names = Object.keys(groups);
  const calls = { listGroups: 0, listUsersInGroup: 0 };
  return {
    calls,
    send: async (cmd: any) => {
      const name = cmd.constructor.name;
      if (name === "ListGroupsCommand") {
        calls.listGroups += 1;
        const from = cmd.input.NextToken ? Number(cmd.input.NextToken) : 0;
        return {
          Groups: names.slice(from, from + 60).map((GroupName) => ({ GroupName })),
          NextToken: from + 60 < names.length ? String(from + 60) : undefined,
        };
      }
      if (name === "ListUsersInGroupCommand") {
        calls.listUsersInGroup += 1;
        const total = groups[cmd.input.GroupName];
        const from = cmd.input.NextToken ? Number(cmd.input.NextToken) : 0;
        const count = Math.min(60, total - from);
        return {
          Users: Array.from({ length: Math.max(0, count) }, (_, i) => ({
            Username: `${cmd.input.GroupName}-u${from + i + 1}`,
            UserStatus: "CONFIRMED",
            Attributes: [{ Name: "email", Value: `${cmd.input.GroupName}${from + i + 1}@x.co` }],
          })),
          NextToken: from + 60 < total ? String(from + 60) : undefined,
        };
      }
      throw new Error(`unexpected ${name}`);
    },
  };
}

describe("listAllGroupsWithUsers", () => {
  it("reads every page of users in a group: 130 users, not 60", async () => {
    const c = fakeCognito({ USERS: 130, ADMINS: 3 });
    const out = await listAllGroupsWithUsers(c, "pool1");
    expect(out.find((g) => g.groupName === "USERS")!.users).toHaveLength(130);
    expect(out.find((g) => g.groupName === "ADMINS")!.users).toHaveLength(3);
    expect(c.calls.listUsersInGroup).toBe(3 + 1); // 3 pages for USERS, 1 for ADMINS
  });

  it("reads every page of groups", async () => {
    const many = Object.fromEntries(Array.from({ length: 75 }, (_, i) => [`G${i + 1}`, 1]));
    const c = fakeCognito(many);
    const out = await listAllGroupsWithUsers(c, "pool1");
    expect(out).toHaveLength(75);
    expect(c.calls.listGroups).toBe(2);
  });

  it("keeps the same output shape", async () => {
    const out = await listAllGroupsWithUsers(fakeCognito({ ADMINS: 1 }), "pool1");
    expect(out).toEqual([{ groupName: "ADMINS", users: [{ username: "ADMINS-u1", email: "ADMINS1@x.co", status: "CONFIRMED" }] }]);
  });

  it("an empty group is listed with no users", async () => {
    expect(await listAllGroupsWithUsers(fakeCognito({ EMPTY: 0 }), "pool1")).toEqual([{ groupName: "EMPTY", users: [] }]);
  });
});

describe("handler", () => {
  it("answers 500 with the same message when Cognito cannot be reached", async () => {
    delete process.env.USER_POOL_ID; // the real client would fail without a pool id and credentials
    const res = await handler();
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ error: "Failed to fetch groups and users" });
  });
});