// amplify/function/notifyWorkAssigned/push.test.ts
import { describe, expect, it } from "vitest";
import { assignmentTitle, buildAssignmentMessages } from "./push";

const token = "ExponentPushToken[abc]";
describe("buildAssignmentMessages", () => {
  it("the alert reads \"New Jc : <job card number>\" with the customer underneath", () => {
    const [m] = buildAssignmentMessages({ pushTokens: [token], jobCardId: "jc1", jcNumber: "JC-QU-0032", customerName: "ESCOM" });
    expect(m).toMatchObject({
      to: token, title: "New Jc : JC-QU-0032", body: "ESCOM", data: { type: "jobcard-assigned", jobCardId: "jc1" },
    });
  });
  it("works without a customer name", () => {
    expect(buildAssignmentMessages({ pushTokens: [token], jobCardId: "jc1", jcNumber: "JC-1" })[0]).toMatchObject({
      title: "New Jc : JC-1", body: "Assigned to you",
    });
  });
  it("never names a work item, even if an older caller sends one", () => {
    const [m] = buildAssignmentMessages({ pushTokens: [token], jobCardId: "jc1", jcNumber: "JC-1", workItemId: "w1", scaleName: "S", workItemLabel: "Inspection" });
    expect(m.title).toBe("New Jc : JC-1");
    expect(m.data).toEqual({ type: "jobcard-assigned", jobCardId: "jc1" });
  });
  it("sends nothing without valid tokens or without a job card", () => {
    expect(buildAssignmentMessages({ pushTokens: ["nope"], jobCardId: "jc1", jcNumber: "JC-1" })).toEqual([]);
    expect(buildAssignmentMessages({ pushTokens: [token], jcNumber: "JC-1" })).toEqual([]);
    expect(buildAssignmentMessages(null)).toEqual([]);
  });
  it("one message per distinct token", () => {
    expect(buildAssignmentMessages({ pushTokens: [token, token, "ExpoPushToken[x]"], jobCardId: "j", jcNumber: "J" })).toHaveLength(2);
  });
  it("the title helper", () => expect(assignmentTitle("JC-9")).toBe("New Jc : JC-9"));
});