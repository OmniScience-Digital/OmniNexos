// Navbar.tsx
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sun, Moon, User, Settings, LogOut, Menu, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";
import Breadcrumbs from "./breadcrumbs";

export default function Navbar() {
  const [isDarkMode, setIsDarkMode] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { user, logout, permission } = useAuth();
  const navigate = useNavigate();

  // Dark mode initialization
  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode");
    const isDark = savedDarkMode === "true";
    setIsDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem("darkMode", newMode.toString());
    document.documentElement.classList.toggle("dark", newMode);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      localStorage.clear();
      sessionStorage.clear();
      await logout();
      window.location.href = '/';
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  if (isDarkMode === null) return null;

  return (
    <div className="fixed top-0 left-0 w-full z-50">
      <header className="flex items-center justify-between bg-[#165b8c] p-4 border-b shadow-md">
        {/* Logo */}
        <Link to={"/"} className="flex items-center cursor-pointer">
          <img
            src="/assets/logo-2.png"
            alt="Logo"
            // width={100}
            // height={80}
            className="h-11 mr-4"
            loading="lazy"
          />
        </Link>

        {/* Mobile Menu */}
        <div className="sm:hidden">
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative focus:outline-none focus:ring-0 hover:bg-transparent cursor-pointer">
                <Menu className="h-4 w-4 text-white" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); setTimeout(() => setMenuOpen(false), 200); }}>
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4" />
                  <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
                  <Moon className="h-4 w-4" />
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem className="text-xs font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer">
                <User className="h-4 w-4" />
                {permission?.name || user?.preferred_username || "User"}
              </DropdownMenuItem>

              {/* ADMIN MENU ITEM - FIXED */}
              {permission?.isAdmin && (
                <DropdownMenuItem
                  onClick={() => {
                    navigate('/admin');
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <div className="flex items-center gap-1 bg-blue-800 px-2 py-1 rounded text-xs">
                    <Shield className="h-3 w-3" />
                    Admin 
                  </div>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem>
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Desktop Menu */}
        <div className="hidden sm:flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-white" />
            <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} className="cursor-pointer" />
            <Moon className="h-4 w-4 text-white" />
          </div>

          {/* Show admin badge on desktop */}
          {permission?.isAdmin && (
            <div 
              onClick={() => navigate('/admin')}
              className="flex items-center gap-1 bg-blue-800 px-2 py-1 rounded text-xs text-white cursor-pointer hover:bg-blue-700"
            >
              <Shield className="h-3 w-3" />
              Admin
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild className="cursor-pointer">
              <Button variant="ghost" size="icon" className="focus:outline-none focus:ring-0 hover:bg-transparent">
                <User className="h-4 w-4 text-white" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-xs font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer">
                <User className="h-4 w-4" />
                {permission?.name || user?.preferred_username || "User"}
              </DropdownMenuItem>
              
              {permission?.isAdmin && (
                <DropdownMenuItem
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Shield className="h-4 w-4" />
                  <span>Admin </span>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem className="cursor-pointer">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              
              <DropdownMenuItem
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <Breadcrumbs />
      {isSigningOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="flex items-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-md shadow-md">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
              Signing out...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}