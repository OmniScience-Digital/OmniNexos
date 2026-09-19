import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { fetchAuthSession, fetchUserAttributes, signOut } from 'aws-amplify/auth';
import { getCurrentUserInfo } from '@/utils/helper/usergroups';
import { client } from '@/services/schema';

interface Permission {
  username: string;
  email: string;
  name: string;
  isAdmin: boolean;
  permissions: string[]; // Add this
}

interface AuthContextType {
  user: any | null;
  permission: Permission | null;
  allUsers: {
    username: string;
    email: string;
    name: string;
    isAdmin: boolean;
  }[] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<Permission | null>(null);
  const [allUsers, setAllUsers] = useState<{
    username: string;
    email: string;
    name: string;
    isAdmin: boolean;
  }[] | null>(null);

  const checkAuth = useCallback(async () => {
    try {
        const session = await fetchAuthSession();

        if (session.tokens) {
            const attributes = await fetchUserAttributes();
            setUser(attributes);
            setIsAuthenticated(true); 

            // Fetch permissions for current user only — fast, no Lambda
            let userPermissions: string[] = [];
            if (attributes.email) {
                try {
                    const permissionData = await client.models.Permission
                        .listPermissionByUserId({ userId: attributes.email });
                    userPermissions = (permissionData.data?.[0]?.permissions ?? [])
                        .filter((p): p is string => p !== null);
                } catch (e) {
                    console.error('Permissions fetch failed:', e);
                }
            }

            // Set current user from attributes directly — no Lambda needed
            setPermission({
                username: attributes.sub || '',
                email: attributes.email || '',
                name: attributes.preferred_username || '',
                isAdmin: userPermissions.includes('admin'),
                permissions: userPermissions
            });

            //  Load all users lazily in background — don't block auth
            getCurrentUserInfo()
                .then(userInfo => setAllUsers(userInfo.allUsers))
                .catch(console.error);

        } else {
            setUser(null);
            setPermission(null);
            setIsAuthenticated(false);
        }
    } catch (error) {
        console.error('checkAuth error:', error);
        setUser(null);
        setPermission(null);
        setIsAuthenticated(false);
    } finally {
        setIsLoading(false); //  always fires, not blocked by usersList
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await signOut();

      setUser(null);
      setPermission(null);
      setIsAuthenticated(false);
      localStorage.setItem("just_logged_out", "true");

    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const justLoggedOut = localStorage.getItem('just_logged_out');
    if (justLoggedOut === 'true') {
      localStorage.removeItem('just_logged_out');
      setIsLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  // Memoize the context value so components consuming useAuth() only
  // re-render when a value they actually depend on changes, instead of
  // on every AuthProvider render (e.g. the background allUsers fetch).
  const value = useMemo<AuthContextType>(() => ({
    user,
    permission,
    allUsers,
    isAuthenticated,
    isLoading,
    checkAuth,
    logout
  }), [user, permission, allUsers, isAuthenticated, isLoading, checkAuth, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}