import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Loader from './components/Loader';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import Dashboard from './pages/Dashboard';
import EditorPage from './pages/EditorPage';
import ProgramManagement from './pages/ProgramManagement';
import ExecutionHistory from './pages/ExecutionHistory';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';
import AnalyticsPage from './pages/AnalyticsPage';
import ChallengesPage from './pages/ChallengesPage';
import ChallengeWorkspace from './pages/ChallengeWorkspace';
import LeaderboardPage from './pages/LeaderboardPage';
import AdminChallenges from './pages/AdminChallenges';
import MySharedCodes from './pages/MySharedCodes';
import SharedCodePage from './pages/SharedCodePage';
import AssessmentsPage from './pages/AssessmentsPage';
import AssessmentWorkspace from './pages/AssessmentWorkspace';
import AssessmentResultPage from './pages/AssessmentResultPage';
import MyCertificates from './pages/MyCertificates';
import CertificateVerificationPage from './pages/CertificateVerificationPage';
import AdminAssessments from './pages/AdminAssessments';

// Main Layout Wrapper
function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-dark-950 text-gray-100">
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0 bg-dark-900/20 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

// Protected Route Guards
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loader fullScreen={true} />;
  }

  return user ? <MainLayout>{children}</MainLayout> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loader fullScreen={true} />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return user.role === 'admin' ? <MainLayout>{children}</MainLayout> : <Navigate to="/dashboard" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loader fullScreen={true} />;
  }

  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Landing Route */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/share/:share_id" element={<SharedCodePage />} />
          <Route path="/verify-certificate/:certificate_id" element={<CertificateVerificationPage />} />

          {/* Authentication Routes */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            } 
          />
          <Route 
            path="/forgot-password" 
            element={
              <PublicRoute>
                <ForgotPasswordPage />
              </PublicRoute>
            } 
          />
          <Route 
            path="/register" 
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            } 
          />

          {/* Protected Developer Routes */}
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/editor/:id?" 
            element={
              <PrivateRoute>
                <EditorPage />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/programs" 
            element={
              <PrivateRoute>
                <ProgramManagement />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/shared-codes" 
            element={
              <PrivateRoute>
                <MySharedCodes />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/assessments" 
            element={
              <PrivateRoute>
                <AssessmentsPage />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/assessments/workspace/:attemptId" 
            element={
              <PrivateRoute>
                <AssessmentWorkspace />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/assessments/result/:attemptId" 
            element={
              <PrivateRoute>
                <AssessmentResultPage />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/certificates" 
            element={
              <PrivateRoute>
                <MyCertificates />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/history" 
            element={
              <PrivateRoute>
                <ExecutionHistory />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/challenges" 
            element={
              <PrivateRoute>
                <ChallengesPage />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/challenges/:id" 
            element={
              <PrivateRoute>
                <ChallengeWorkspace />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/leaderboard" 
            element={
              <PrivateRoute>
                <LeaderboardPage />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <PrivateRoute>
                <ProfilePage />
              </PrivateRoute>
            } 
          />

          {/* Protected System Admin Routes */}
          <Route 
            path="/admin" 
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } 
          />
          <Route 
            path="/admin/users" 
            element={
              <AdminRoute>
                <UserManagement />
              </AdminRoute>
            } 
          />
          <Route 
            path="/admin/challenges" 
            element={
              <AdminRoute>
                <AdminChallenges />
              </AdminRoute>
            } 
          />
          <Route 
            path="/admin/assessments" 
            element={
              <AdminRoute>
                <AdminAssessments />
              </AdminRoute>
            } 
          />
          <Route 
            path="/admin/analytics" 
            element={
              <AdminRoute>
                <AnalyticsPage />
              </AdminRoute>
            } 
          />

          {/* Fallback Redirection */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
