// amplify/function/notifyWorkAssigned/push.test.ts
import { describe, expect, it } from "vitest";
import { buildAssignmentMessages } from "./push";

const token = "ExponentPushToken[abc]";
describe("buildAssignmentMessages", () => {
  it("job card assignment: names the job card and customer, carries no work item", () => {
    const [m] = buildAssignmentMessages({ pushTokens: [token], jobCardId: "jc1", jcNumber: "JC-QU-0032", customerName: "ESCOM" });
    expect(m).toMatchObject({ to: token, title: "Job card assigned to you", body: "JC-QU-0032 - ESCOM", data: { type: "jobcard-assigned", jobCardId: "jc1" } });
    expect(m.data).not.toHaveProperty("workItemId");
  });
  it("works without a customer name", () => {
    expect(buildAssignmentMessages({ pushTokens: [token], jobCardId: "jc1", jcNumber: "JC-1" })[0].body).toBe("JC-1");
  });
  it("still builds the old single work item message for an old caller", () => {
    const [m] = buildAssignmentMessages({ pushTokens: [token], jobCardId: "jc1", jcNumber: "JC-1", workItemId: "w1", scaleName: "S", workItemLabel: "Inspection" });
    expect(m).toMatchObject({ title: "New job card work", body: "Inspection - S (JC-1)", data: { workItemId: "w1" } });
  });
  it("sends nothing without valid tokens or without a job card", () => {
    expect(buildAssignmentMessages({ pushTokens: ["nope"], jobCardId: "jc1", jcNumber: "JC-1" })).toEqual([]);
    expect(buildAssignmentMessages({ pushTokens: [token], jcNumber: "JC-1" })).toEqual([]);
    expect(buildAssignmentMessages(null)).toEqual([]);
  });
  it("one message per distinct token", () => {
    expect(buildAssignmentMessages({ pushTokens: [token, token, "ExpoPushToken[x]"], jobCardId: "j", jcNumber: "J" })).toHaveLength(2);
  });
});