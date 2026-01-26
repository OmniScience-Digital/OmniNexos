import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/auth-context'; 
import Navbar from './components/layout/navbar';
import { AuthScreen } from './components/auth/auth_screen';
import Footer from './components/layout/footer';
import FormsLanding from './app/forms';
import Landing from './app/landing';
import ComponentForm from './app/stockcontrolform/page';


function Layout() {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth(); // Add isLoading here
  
  
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

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {!isAuthPage && <Navbar />}
      <Routes>
        <Route path="/" element={<AuthScreen />} />
        <Route path="/landing" element={isAuthenticated ? <Landing /> : <Navigate to="/" replace />} />
        <Route path="/forms" element={isAuthenticated ? <FormsLanding /> : <Navigate to="/" replace />} />
        <Route path="/stockcontrolform" element={isAuthenticated ? <ComponentForm /> : <Navigate to="/" replace />} />
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