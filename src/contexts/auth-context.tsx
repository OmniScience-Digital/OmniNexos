import { createContext, useContext, useState, useEffect } from 'react';
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

  useEffect(() => {
    const justLoggedOut = localStorage.getItem('just_logged_out');
    if (justLoggedOut === 'true') {
      localStorage.removeItem('just_logged_out');
      setIsLoading(false);
      return;
    }
    checkAuth();
  }, []);


  // const checkAuth = async () => {
  //   try {
  //     const session = await fetchAuthSession();

  //     if (session.tokens) {
  //       // Run these two independent calls in parallel
  //       const [attributes, userInfo] = await Promise.all([
  //         fetchUserAttributes(),
  //         getCurrentUserInfo()
  //       ]);

  //       setUser(attributes);
  //       setIsAuthenticated(true);

  //       let isAdminUser = false;
  //       let userPermissions: string[] = [];

  //       if (attributes.email) {
  //         try {
  //           // Fetch permissions in parallel while we process other data
  //           const permissionPromise = client.models.Permission.listPermissionByUserId({
  //             userId: attributes.email
  //           });

  //           // Process user info while waiting for permissions
  //           const permissionData = await permissionPromise;

  //           if (permissionData.data && permissionData.data[0]?.permissions) {
  //             userPermissions = permissionData.data[0].permissions.filter(p => p !== null) as string[];
  //             isAdminUser = userPermissions.includes('admin');
  //           }
  //         } catch (permError) {
  //           console.error('Error fetching permissions:', permError);
  //         }
  //       }
  //       console.log(userPermissions);
  //       setPermission({
  //         username: userInfo.currentUser?.username || '',
  //         email: userInfo.currentUser?.email || '',
  //         name: userInfo.currentUser?.name || '',
  //         isAdmin: isAdminUser,
  //         permissions: userPermissions
  //       });

  //       setAllUsers(userInfo.allUsers);
  //     } else {
  //       setUser(null);
  //       setPermission(null);
  //       setIsAuthenticated(false);
  //     }
  //   } catch (error) {
  //     setUser(null);
  //     setPermission(null);
  //     setIsAuthenticated(false);
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  const checkAuth = async () => {
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

            // ✅ Load all users lazily in background — don't block auth
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
        setIsLoading(false); // ✅ always fires, not blocked by usersList
    }
};
  const logout = async () => {
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
  };


  return (
    <AuthContext.Provider value={{
      user,
      permission,
      allUsers,
      isAuthenticated,
      isLoading,
      checkAuth,
      logout
    }}>
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