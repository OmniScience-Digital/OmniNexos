import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
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


function Layout() {
  const location = useLocation();
  const { isAuthenticated, isLoading, permission } = useAuth(); // Add isLoading here

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

  const requireAuth = (element: React.ReactElement, requireAdmin = false, requirePermission?: string) => {
    if (!isAuthenticated) return <Navigate to="/" replace />;

    if (requireAdmin && !permission?.isAdmin) {
      return <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p>Admin access required</p>
        </div>
      </div>;
    }

    if (requirePermission && !permission?.permissions?.some(p => p.startsWith(requirePermission))) {
      return <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p>You need {requirePermission} permission</p>
        </div>
      </div>;
    }

    return element;
  };



  console.log(permission)
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {!isAuthPage && <Navbar />}
      <Routes>
        <Route path="/" element={<AuthScreen />} />
        <Route path="/landing" element={requireAuth(<Landing />)} />
        <Route path="/forms" element={requireAuth(<FormsLanding />)} />
        <Route path="/stockcontrolform" element={requireAuth(<ComponentForm />)} />
        <Route path="/admin" element={requireAuth(<AdminPermissionsPage />, true)} />
        <Route path="/fleetmanagementsystem" element={requireAuth(<FleetPage />, false, 'fms.')} />
        <Route path="/inventorymanagementsystem" element={requireAuth(<IMS />, false, 'ims.')} />
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