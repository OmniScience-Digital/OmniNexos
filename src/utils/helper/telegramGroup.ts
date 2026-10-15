// src/utils/helper/telegramGroup.ts  (NEW FILE)
// Validation for adding a Telegram group by hand (name + chat ID). Pure.

export interface GroupInput { groupName: string; chatId: string }
export type GroupValidation =
  | { ok: true; value: GroupInput }
  | { ok: false; error: string };

/**
 * Telegram chat IDs are whole numbers. Groups are negative (e.g. -987654321) and supergroups look like
 * -1001234567890. Spaces and a stray "+" are tolerated; anything else is rejected.
 */
export function normalizeChatId(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, "").replace(/^\+/, "");
  return /^-?\d{5,20}$/.test(t) ? t : null;
}

export function validateGroupInput(input: GroupInput): GroupValidation {
  const groupName = input.groupName.trim().replace(/\s+/g, " ");
  if (!groupName) return { ok: false, error: "Enter the group name." };
  if (groupName.length > 100) return { ok: false, error: "The group name is too long (100 characters at most)." };
  const chatId = normalizeChatId(input.chatId);
  if (!chatId) {
    return { ok: false, error: "The chat ID must be a number, for example -1001234567890 (group chat IDs start with a minus)." };
  }
  return { ok: true, value: { groupName, chatId } };
}

/** Row id for a Telegram group: derived from the chat ID, shared with the backend bot capture. */
export const telegramGroupId = (chatId: string): string => `tg${chatId}`;