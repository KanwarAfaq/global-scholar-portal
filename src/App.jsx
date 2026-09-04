import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from './components/ThemeProvider';
import { AuthProvider } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import OpportunityBlog from './pages/OpportunityBlog';
import Analytics from './pages/Analytics';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Applications from './pages/Applications';
import Copilot from './pages/Copilot';
import Auth from './pages/Auth';
import ResumeBuilder from './pages/ResumeBuilder';
import Profiles from './pages/Profiles';
import PasswordReset from './pages/PasswordReset';
import ChangeEmail from './pages/ChangeEmail';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import PrivacyPolicy from './pages/PrivacyPolicy';

export default function App() {
  return (
    <HelmetProvider>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                
                {/* --- PUBLIC ROUTES --- */}
                <Route path="auth" element={<Auth />} />
                <Route path="reset-password" element={<PasswordReset />} />
                <Route path="blog" element={<Blog />} />
                <Route path="blog/:slug" element={<BlogPost />} />
                <Route path="/opportunity/:id/blog" element={<OpportunityBlog />} 
                />
                <Route path="privacy-policy" element={<PrivacyPolicy />} />
                {/* --- PROTECTED ROUTES --- */}
                <Route 
                  index 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />

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
                  path="change-email" 
                  element={
                    <ProtectedRoute>
                      <ChangeEmail />
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

              {/* Catch-all route */}
              <Route path="*" element={<Navigate to="/" replace />} />
              
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}