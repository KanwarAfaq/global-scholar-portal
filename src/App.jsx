import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
              <Route index element={<Dashboard />} />
              <Route path="auth" element={<Auth />} />
              <Route path="resume-builder" element={<ResumeBuilder />} />
              {/* Protected Routes */}
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
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;