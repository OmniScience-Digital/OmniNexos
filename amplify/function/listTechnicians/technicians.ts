// amplify/function/listTechnicians/technicians.ts  (NEW FILE)
// Pure mapping from Cognito users to the short list shown in the "assign to" picker. No AWS calls here.

export interface CognitoUserLike {
  Username?: string;
  Enabled?: boolean;
  UserStatus?: string;
  Attributes?: { Name?: string; Value?: string }[];
}
export interface TechnicianRow {
  id: string; // Cognito sub: stable, never reused
  name: string;
  email: string | null;
}

/** Accounts that can never sign in again are left out. Invited users who have not logged in yet are kept. */
const EXCLUDED_STATUSES = new Set(["ARCHIVED", "COMPROMISED", "UNKNOWN"]);

const attr = (u: CognitoUserLike, name: string) => u.Attributes?.find((a) => a.Name === name)?.Value || undefined;

export function toTechnicians(users: CognitoUserLike[]): TechnicianRow[] {
  const byId = new Map<string, TechnicianRow>();
  for (const u of users) {
    if (u.Enabled === false) continue;
    if (u.UserStatus && EXCLUDED_STATUSES.has(u.UserStatus)) continue;
    const id = attr(u, "sub");
    if (!id) continue;
    const email = attr(u, "email") ?? null;
    byId.set(id, { id, name: attr(u, "preferred_username") ?? attr(u, "name") ?? email ?? u.Username ?? id, email });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}