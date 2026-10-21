// amplify/function/listTechnicians/technicians.ts  (MODIFIED - one row per PERSON, not per Cognito account)
// Pure mapping from Cognito users to the short list shown in the "assign to" picker. No AWS calls here.

export interface CognitoUserLike {
  Username?: string;
  Enabled?: boolean;
  UserStatus?: string;
  Attributes?: { Name?: string; Value?: string }[];
}
export interface TechnicianRow {
  id: string; // Cognito sub of the NATIVE account when one exists (stable, never reused)
  name: string;
  email: string | null;
  /** Every other sub that belongs to the same person (e.g. their Google_ account). */
  aliases: string[];
}

const EXCLUDED_STATUSES = new Set(["ARCHIVED", "COMPROMISED", "UNKNOWN"]);

const attr = (u: CognitoUserLike, name: string) => u.Attributes?.find((a) => a.Name === name)?.Value || undefined;

/** Federated accounts are named "<Provider>_<id>" (e.g. Google_1234). Native ones are UUIDs. */
const isFederated = (u: CognitoUserLike) => u.UserStatus === "EXTERNAL_PROVIDER" || (u.Username ?? "").includes("_");

export function toTechnicians(users: CognitoUserLike[]): TechnicianRow[] {
  // Group accounts by lower-cased email: same email = same person.
  const people = new Map<string, CognitoUserLike[]>();
  for (const u of users) {
    if (u.Enabled === false) continue;
    if (u.UserStatus && EXCLUDED_STATUSES.has(u.UserStatus)) continue;
    const sub = attr(u, "sub");
    if (!sub) continue;
    const email = attr(u, "email")?.trim().toLowerCase();
    const key = email ?? `sub:${sub}`; // no email -> cannot merge, keep on its own
    people.set(key, [...(people.get(key) ?? []), u]);
  }

  const rows: TechnicianRow[] = [];
  for (const group of people.values()) {
    // Prefer the native account as the canonical one, then the oldest-listed.
    const sorted = [...group].sort((a, b) => Number(isFederated(a)) - Number(isFederated(b)));
    const main = sorted[0];
    const id = attr(main, "sub")!;
    const email = attr(main, "email") ?? null;
    // Prefer a name from a native account; fall back to any account's name, then email.
    const name =
      sorted.map((u) => attr(u, "preferred_username") ?? attr(u, "name")).find(Boolean) ?? email ?? main.Username ?? id;
    rows.push({ id, name, email, aliases: sorted.slice(1).map((u) => attr(u, "sub")!).filter(Boolean) });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}