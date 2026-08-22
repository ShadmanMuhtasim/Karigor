import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterCustomerPage } from './pages/auth/RegisterCustomerPage';
import { RegisterWorkerPage } from './pages/auth/RegisterWorkerPage';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { WorkerDashboard } from './pages/WorkerDashboard';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { Categories } from './pages/Categories';

/**
 * SmartDashboard — redirects an authenticated user to their
 * role-specific dashboard without requiring role props on ProtectedRoute.
 */
function SmartDashboard() {
  const { user } = useAuth();
  if (user?.role === 'Worker') return <Navigate to="/dashboard/worker" replace />;
  return <Navigate to="/dashboard/customer" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register/customer" element={<RegisterCustomerPage />} />
          <Route path="/register/worker" element={<RegisterWorkerPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="/categories" element={<Categories />} />

          {/* Smart redirect from /dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <SmartDashboard />
              </ProtectedRoute>
            }
          />

          {/* Role-protected dashboards */}
          <Route
            path="/dashboard/customer"
            element={
              <ProtectedRoute requiredRole="Customer">
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/worker"
            element={
              <ProtectedRoute requiredRole="Worker">
                <WorkerDashboard />
              </ProtectedRoute>
            }
          />

          {/* Default: authenticated users → dashboard, guests → login */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
