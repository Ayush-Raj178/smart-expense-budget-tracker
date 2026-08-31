import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import SidebarLayout from './components/SidebarLayout';
import ProtectedRoute from './components/ProtectedRoute';
import RouteLoadingFallback from './components/RouteLoadingFallback';
import './App.css';

const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Budgets = lazy(() => import('./pages/Budgets'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));

const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const pageTransition = {
  duration: 0.3,
  ease: 'easeInOut',
};

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();

  return (
    <div className="app">
      <Suspense fallback={<RouteLoadingFallback />}>
        <AnimatePresence mode="wait">
          <Routes>
            <Route
              path="/login"
              element={
                <motion.div
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={pageTransition}
                >
                  <Login />
                </motion.div>
              }
            />
            <Route
              path="/signup"
              element={
                <motion.div
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={pageTransition}
                >
                  <Signup />
                </motion.div>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <motion.div
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={pageTransition}
                >
                  <ForgotPassword />
                </motion.div>
              }
            />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <SidebarLayout>
                    <Dashboard />
                  </SidebarLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <ProtectedRoute>
                  <SidebarLayout>
                    <Expenses />
                  </SidebarLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/budgets"
              element={
                <ProtectedRoute>
                  <SidebarLayout>
                    <Budgets />
                  </SidebarLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <SidebarLayout>
                    <Notifications />
                  </SidebarLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={
                loading ? null : (
                  (() => {
                    const targetPath = user ? "/dashboard" : "/login";
                    if (location.pathname === targetPath) {
                      return null;
                    }
                    return <Navigate to={targetPath} replace />;
                  })()
                )
              }
            />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <NotificationProvider>
      <Router>
        <AppRoutes />
      </Router>
    </NotificationProvider>
  );
}

export default App;
