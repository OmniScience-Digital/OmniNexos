import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { fetchAuthSession, fetchUserAttributes, signOut } from 'aws-amplify/auth';

interface AuthContextType {
  user: any | null;
  isAuthenticated: boolean;
  isLoading: boolean; // ADD THIS
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // INITIALIZE AS TRUE

  const checkAuth = async () => {
    try {
      const session = await fetchAuthSession();
      
      if (session.tokens) {
        const attributes = await fetchUserAttributes();
        setUser(attributes);
        setIsAuthenticated(true);
        //preferred_username
        localStorage.setItem('user_name', attributes.preferred_username || '');
        localStorage.setItem('user_email', attributes.email || '');
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false); 
    }
  };

  const logout = async () => {
    try {
      setIsLoading(false);
      await signOut();
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('user_email');
      localStorage.setItem('just_logged_out', 'true'); 
    } catch (error) {
      console.error('Logout error:', error);
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
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, checkAuth, logout }}>
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