import NoticeHost from '../NoticeHost';
import RouteBoundary from '../RouteBoundary';
import PageMetadata from '../PageMetadata';
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import Footer from './Footer';
import {useAuth} from '../../context/session';
import SignupBenefitsBanner from '../SignupBenefitsBanner';

export default function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user } = useAuth();
  return (
    <div className="relative isolate flex flex-col min-h-screen bg-slate-50 dark:bg-[#07101f] transition-colors duration-300 selection:bg-indigo-500/30 overflow-x-hidden"><div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 opacity-80 dark:opacity-60 bg-[radial-gradient(circle_at_15%_10%,rgba(99,102,241,.12),transparent_24%),radial-gradient(circle_at_85%_18%,rgba(34,211,238,.10),transparent_22%),radial-gradient(circle_at_50%_90%,rgba(139,92,246,.08),transparent_28%)]" />
      <Navbar toggleSidebar={user ? () => setIsSidebarOpen(!isSidebarOpen) : null} />
      {user && <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />}
      {user && isSidebarOpen && <div className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <div className={`min-w-0 flex flex-col flex-1 transition-all duration-300 ${user ? 'lg:ml-64' : ''}`}>
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8"><NoticeHost /><PageMetadata /><RouteBoundary><Outlet /></RouteBoundary></main>
        <Footer />
      </div>
      {!user && <SignupBenefitsBanner />}
    </div>
  );
}
