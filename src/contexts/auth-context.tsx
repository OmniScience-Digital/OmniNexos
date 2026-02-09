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

  const checkAuth = async () => {
    try {
      const session = await fetchAuthSession();

      if (session.tokens) {
        const attributes = await fetchUserAttributes();
        setUser(attributes);
        setIsAuthenticated(true);

        const info = await getCurrentUserInfo();
        
        let isAdminUser = false;
        let userPermissions: string[] = [];
        
        if (attributes.email) {
          try {
            const { data } = await client.models.Permission.listPermissionByUserId({
              userId: attributes.email 
            });
            
            if (data && data[0]?.permissions) {
              userPermissions = data[0].permissions.filter(p => p !== null) as string[];
              isAdminUser = userPermissions.includes('admin');
            }
          } catch (permError) {
            console.error('Error fetching permissions:', permError);
          }
        }
        
        setPermission({
          username: info.currentUser?.username || '',
          email: info.currentUser?.email || '',
          name: info.currentUser?.name || '',
          isAdmin: isAdminUser,
          permissions: userPermissions 
        });
        
        setAllUsers(info.allUsers);
      } else {
        setUser(null);
        setPermission(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      setUser(null);
      setPermission(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await signOut();
      setUser(null);
      setPermission(null);
      setIsAuthenticated(false);
      localStorage.removeItem('just_logged_out');
      localStorage.setItem('just_logged_out', 'true');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const justLoggedOut = localStorage.getItem('just_logged_out');
    if (justLoggedOut === 'true') {
      localStorage.removeItem('just_logged_out');
      setIsLoading(false);
      return;
    }
    checkAuth();
  }, []);

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