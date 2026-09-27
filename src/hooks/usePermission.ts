// src/hooks/usePermission.ts
//
// Replaces the same block, copy-pasted in 12 files across the app:
//
//   const [xPermissions, setXPermissions] = useState(false);
//   useEffect(() => {
//     if (permission?.permissions?.includes('some.string') || permission?.isAdmin) {
//       setXPermissions(true);
//     } else {
//       setXPermissions(false);
//     }
//   }, [permission]);
//
// This is a pure derivation from `permission` — it doesn't need an effect at
// all (only a plain, memoized value), so this both removes the duplication
// and avoids 12 unnecessary renders-then-an-effect on every mount.
import { useAuth } from "@/contexts/auth-context";
import { useMemo } from "react";

/**
 * @param permissionString e.g. 'fms.edit', 'crm.compliance.edit'
 * @returns true if the current user has that specific permission, or is an admin.
 */
export function usePermission(permissionString: string): boolean {
  const { permission } = useAuth();
  return useMemo(
    () => Boolean(permission?.permissions?.includes(permissionString) || permission?.isAdmin),
    [permission, permissionString],
  );
}
