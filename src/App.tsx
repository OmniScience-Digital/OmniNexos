import { BrowserRouter as Router, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/auth-context';
import Navbar from './components/layout/navbar';
import { AuthScreen } from './components/auth/auth_screen';
import Footer from './components/layout/footer';
import FormsLanding from './app/forms';
import Landing from './app/landing';
import ComponentForm from './app/stockcontrolform/page';
import AdminPermissionsPage from './app/admin/page';
import FleetPage from './app/fleetmanagementsystem/page';
import IMS from './app/inventorymanagementsystem/page';
import CustomerRelationsManagement from './app/customerrelationsmanagement/page';
import HumanResourcesPage from './app/humanresourcesdepartment/page';
import Vehicle_Inspection_Form from './app/vehicleinspectionform/page';

function Layout() {
  const location = useLocation();
  const { isAuthenticated, isLoading, permission } = useAuth();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isAuthPage = location.pathname === '/';

  // Only do redirects AFTER loading is complete
  if (!isAuthPage && !isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (isAuthPage && isAuthenticated) {
    return <Navigate to="/landing" replace />;
  }

  // Minimal Access Denied Component
  const AccessDenied = ({ requiredPermission, message }: { requiredPermission?: string, message?: string }) => {
    const navigate = useNavigate();

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-3">⛔</div>
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">
              {message || "Access Denied"}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Insufficient permissions to access this page
            </p>
          </div>

          {requiredPermission && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                Requires: <code className="ml-1 px-2 py-1 bg-white dark:bg-gray-800 rounded text-red-800 dark:text-red-200">{requiredPermission}*</code>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                * Any permission starting with this prefix
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => navigate(-1)}
              className="flex-1 cursor-pointer px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={() => navigate('/landing')}
              className="flex-1 px-3 py-2 cursor-pointer text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Go to Landing
            </button>
          </div>
        </div>
      </div>
    );
  };

  const requireAuth = (element: React.ReactElement, requireAdmin = false, requirePermission?: string) => {
    if (!isAuthenticated) return <Navigate to="/" replace />;

    // Admin users have full access
    const isAdminUser = permission?.isAdmin || permission?.permissions?.includes('admin');

    if (requireAdmin && !isAdminUser) {
      return <AccessDenied requiredPermission="admin" message="Admin Access Required" />;
    }

    // Admin users bypass permission checks
    if (!isAdminUser && requirePermission && !permission?.permissions?.some(p => p.startsWith(requirePermission))) {
      return <AccessDenied requiredPermission={requirePermission} />;
    }

    return element;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {!isAuthPage && <Navbar />}
      <Routes>
        <Route path="/" element={<AuthScreen />} />
        <Route path="/landing" element={requireAuth(<Landing />)} />
        <Route path="/forms" element={requireAuth(<FormsLanding />)} />
        <Route path="/stockcontrolform" element={requireAuth(<ComponentForm />, false, 'scf.')} />
        <Route path="/vehicleinspectionform" element={requireAuth(<Vehicle_Inspection_Form />, false, 'vif.')} />
        <Route path="/admin" element={requireAuth(<AdminPermissionsPage />, true)} />
        <Route path="/fleetmanagementsystem" element={requireAuth(<FleetPage />, false, 'fms.')} />
        <Route path="/inventorymanagementsystem" element={requireAuth(<IMS />, false, 'ims.')} />
        <Route path="/customerrelationsmanagement" element={requireAuth(<CustomerRelationsManagement />, false, 'crm.')} />
        <Route path="/humanresourcesdepartment" element={requireAuth(<HumanResourcesPage />, false, 'hrd.')} />
      </Routes>
      {!isAuthPage && <Footer />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout />
      </Router>
    </AuthProvider>
  );
}

export default App;