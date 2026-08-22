import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import { AuthProvider } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Analytics from './pages/Analytics';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Applications from './pages/Applications';
import Copilot from './pages/Copilot';
import Auth from './pages/Auth';
import ResumeBuilder from './pages/ResumeBuilder';
import Profiles from './pages/Profiles';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              
              {/* PUBLIC ROUTE */}
              <Route path="auth" element={<Auth />} />

              {/* PROTECTED ROUTES */}
              {/* This handles the root URL "/" */}
              <Route 
                index 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />

              {/* This handles the explicit "/dashboard" URL */}
              <Route 
                path="dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="resume-builder" 
                element={
                  <ProtectedRoute>
                    <ResumeBuilder />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="applications" 
                element={
                  <ProtectedRoute>
                    <Applications />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="settings" 
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="profiles" 
                element={
                  <ProtectedRoute>
                    <Profiles />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="analytics" 
                element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="copilot" 
                element={
                  <ProtectedRoute>
                    <Copilot />
                  </ProtectedRoute>
                } 
              />
            </Route>

            {/* Catch-all route to redirect any unknown URLs back to the dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
            
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;