import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SplashScreen } from './components/SplashScreen';

// Pages
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterCustomerPage } from './pages/auth/RegisterCustomerPage';
import { RegisterWorkerPage } from './pages/auth/RegisterWorkerPage';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { WorkerDashboard } from './pages/WorkerDashboard';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { Categories } from './pages/Categories';
import { CreateRequestPage } from './pages/CreateRequestPage';
import { RequestDetailPage } from './pages/RequestDetailPage';
import { SearchWorkersPage } from './pages/SearchWorkersPage';
import { WorkerProfilePage } from './pages/WorkerProfilePage';
import { BookingDetailPage } from './pages/BookingDetailPage';

/**
 * RootRouteHandler — implements the routing logic requested:
 * - When not logged in: Route to the login page.
 * - When logged in: Route to the regular dashboard/home page.
 */
function RootRouteHandler() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/home" replace />;
}

/**
 * SmartDashboard — redirects an authenticated user to their
 * role-specific dashboard without requiring role props on ProtectedRoute.
 */
function SmartDashboard() {
  const { user } = useAuth();
  if (user?.role === 'Worker') return <Navigate to="/dashboard/worker" replace />;
  return <Navigate to="/dashboard/customer" replace />;
}

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <Routes>
        {/* Public Routes */}
        <Route path="/home" element={<HomePage />} />
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

        {/* Customer Routes */}
        <Route
          path="/dashboard/customer"
          element={
            <ProtectedRoute requiredRole="Customer">
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customer/dashboard"
          element={
            <ProtectedRoute requiredRole="Customer">
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customer/requests/new"
          element={
            <ProtectedRoute requiredRole="Customer">
              <CreateRequestPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customer/requests/:id"
          element={
            <ProtectedRoute requiredRole="Customer">
              <RequestDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customer/search"
          element={
            <ProtectedRoute requiredRole="Customer">
              <SearchWorkersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customer/worker/:id"
          element={
            <ProtectedRoute requiredRole="Customer">
              <WorkerProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Worker Routes */}
        <Route
          path="/dashboard/worker"
          element={
            <ProtectedRoute requiredRole="Worker">
              <WorkerDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/bookings/:id" element={<ProtectedRoute><BookingDetailPage /></ProtectedRoute>} />

        {/* Root: When not logged in -> /login; When logged in -> /home */}
        <Route path="/" element={<RootRouteHandler />} />

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
