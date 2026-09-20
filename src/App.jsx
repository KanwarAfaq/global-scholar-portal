import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from './components/ThemeProvider';
import { AuthProvider } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
const OpportunityBlog = lazy(() => import('./pages/OpportunityBlog'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Applications = lazy(() => import('./pages/Applications'));
const Copilot = lazy(() => import('./pages/Copilot'));
const Auth = lazy(() => import('./pages/Auth'));
const ResumeBuilder = lazy(() => import('./pages/ResumeBuilder'));
const Profiles = lazy(() => import('./pages/Profiles'));
const PasswordReset = lazy(() => import('./pages/PasswordReset'));
const ChangeEmail = lazy(() => import('./pages/ChangeEmail'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Intelligence = lazy(() => import('./pages/Intelligence'));
const Programs = lazy(() => import('./pages/Programs'));
const SponsorWorkspace = lazy(() => import('./pages/SponsorWorkspace'));
const SponsoredOpportunities = lazy(() => import('./pages/SponsoredOpportunities'));
const CounselorWorkspace = lazy(() => import('./pages/CounselorWorkspace'));
const CounselorInvites = lazy(() => import('./pages/CounselorInvites'));
const Account = lazy(() => import('./pages/Account'));
const Terms = lazy(() => import('./pages/Terms'));
const Quality = lazy(() => import('./pages/Quality'));
const Admin = lazy(() => import('./pages/Admin'));
const Notifications = lazy(() => import('./pages/Notifications'));

export default function App() {
  return (
    <HelmetProvider>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<p className="p-8" role="status">Loading page…</p>}><Routes>
              <Route path="/" element={<MainLayout />}>
                <Route path="auth" element={<Auth />} />
                <Route path="reset-password" element={<PasswordReset />} />
                <Route path="blog" element={<Blog />} />
                <Route path="blog/:slug" element={<BlogPost />} />
                <Route path="opportunity/:id/blog" element={<OpportunityBlog />} />
                <Route path="privacy-policy" element={<PrivacyPolicy />} />
                <Route path="terms" element={<Terms />} />
                <Route path="pricing" element={<Pricing />} />
                <Route path="programs" element={<Programs />} />
                <Route index element={<Dashboard />} />
                <Route path="dashboard" element={<Dashboard />} />

                <Route path="resume-builder" element={<ProtectedRoute><ResumeBuilder /></ProtectedRoute>} />
                <Route path="change-email" element={<ProtectedRoute><ChangeEmail /></ProtectedRoute>} />
                <Route path="applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
                <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="profiles" element={<ProtectedRoute><Profiles /></ProtectedRoute>} />
                <Route path="analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="copilot" element={<ProtectedRoute><Copilot /></ProtectedRoute>} />
                <Route path="intelligence" element={<ProtectedRoute><Intelligence /></ProtectedRoute>} />
                <Route path="notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                <Route path="sponsored" element={<ProtectedRoute><SponsoredOpportunities /></ProtectedRoute>} />
                <Route path="sponsor" element={<ProtectedRoute><SponsorWorkspace /></ProtectedRoute>} />
                <Route path="counselor" element={<ProtectedRoute><CounselorWorkspace /></ProtectedRoute>} />
                <Route path="counselor-invites" element={<ProtectedRoute><CounselorInvites /></ProtectedRoute>} />
                <Route path="account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
                <Route path="quality" element={<ProtectedRoute roles={['admin','staff']}><Quality /></ProtectedRoute>} />
                <Route path="admin" element={<ProtectedRoute roles={['admin']}><Admin /></ProtectedRoute>} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes></Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}
