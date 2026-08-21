import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  Sparkles, FileText, Building2, MapPin, Loader2, 
  Copy, CheckCircle2, Download, Eye, X, Image as ImageIcon,
  Mail, Briefcase, GraduationCap, Award
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Initialize Supabase & Gemini
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export default function Copilot() {
  const { user } = useAuth();
  
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [loadingApps, setLoadingApps] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  
  // Generation & Mode States
  const [generating, setGenerating] = useState(false);
  const [resultText, setResultText] = useState('');
  const [resumeData, setResumeData] = useState(null); 
  const [copied, setCopied] = useState(false);
  const [promptType, setPromptType] = useState('resume'); 
  const [cvType, setCvType] = useState('Academic CV');
  
  // PDF Preview & Photo Customization
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [includePhoto, setIncludePhoto] = useState(true);

  useEffect(() => {
    fetchSavedApplications();
    if (user) fetchUserProfiles();
  }, [user]);

  async function fetchUserProfiles() {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id);
        
      if (data && data.length > 0) {
        setProfiles(data);
        setSelectedProfileId(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching profiles:', err.message);
    }
  }

  async function fetchSavedApplications() {
    setLoadingApps(true);
    try {
      const { data, error } = await supabase
        .from('user_applications')
        .select('id, status, global_opportunities(*)');

      if (error) throw error;
      
      const formattedApps = data
        .filter(app => app.global_opportunities)
        .map(app => ({
          appId: app.id,
          status: app.status,
          ...app.global_opportunities
        }));

      setApplications(formattedApps);
      if (formattedApps.length > 0) setSelectedApp(formattedApps[0]);
    } catch (err) {
      console.error('Error fetching applications:', err.message);
    } finally {
      setLoadingApps(false);
    }
  }

  const activeProfile = profiles.find(p => p.id === selectedProfileId);

  const handleGenerate = async () => {
    if (!selectedApp) return;
    setGenerating(true);
    setResultText('');
    setResumeData(null);
    setCopied(false);

    const isResume = promptType === 'resume';

    const systemPrompt = `You are an elite career strategist and CV designer.
Candidate Name: ${activeProfile?.full_name || 'Candidate'}
Email: ${user?.email || 'email@example.com'}
Candidate Bio & Background: ${activeProfile?.bio || 'Not specified'}
Candidate Skills: ${activeProfile?.skills || 'Not specified'}

Target Position: ${selectedApp.title}
Target Organization: ${selectedApp.organization} (${selectedApp.country})
Target Degree/Type: ${selectedApp.type}
Description: ${selectedApp.description || ''}
Key Requirements/Tags: ${(selectedApp.tags || []).join(', ')}`;

    let userPrompt = "";
    if (isResume) {
      userPrompt = `Generate a comprehensive, modern ${cvType} tailored specifically to this opportunity.
You MUST output ONLY a valid JSON object (no markdown quotes, no triple backticks, no trailing comments) with this exact schema:
{
  "fullName": "${activeProfile?.full_name || 'Candidate Name'}",
  "professionalTitle": "Specialist in ${selectedApp.field || 'Research & Strategy'}",
  "email": "${user?.email || 'contact@candidate.com'}",
  "location": "${selectedApp.country || 'Global'}",
  "summary": "3-4 sentence powerful summary highlighting tailored fit for ${selectedApp.title} at ${selectedApp.organization}.",
  "skills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5", "Skill 6"],
  "experience": [
    {
      "role": "Relevant Position / Researcher",
      "company": "Institution / Company Name",
      "period": "2022 - Present",
      "highlights": [
        "Tailored bullet point matching ${selectedApp.title} keyword requirements.",
        "Demonstrated impactful outcome with measurable results."
      ]
    },
    {
      "role": "Academic / Project Lead",
      "company": "University / Organization",
      "period": "2020 - 2022",
      "highlights": [
        "Key initiative directly supporting background needed for ${selectedApp.field || 'this discipline'}."
      ]
    }
  ],
  "education": [
    {
      "degree": "Degree relevant to ${selectedApp.type}",
      "institution": "University / College Name",
      "year": "2019 - 2023",
      "honors": "Distinction / GPA / Key Coursework"
    }
  ],
  "awards": ["Award / Key Publication / Fellowship"]
}`;
    } else if (promptType === 'cover_letter') {
      userPrompt = `Write a professional, compelling cover letter (under 300 words) tailored to ${selectedApp.title} at ${selectedApp.organization}.`;
    } else {
      userPrompt = `Write a short, engaging cold email (under 150 words) to the hiring committee or professor for ${selectedApp.title}. Include a subject line.`;
    }

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
      const response = await result.response;
      const textOutput = response.text();

      if (isResume) {
        const cleanJson = textOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        setResumeData(parsed);
        setShowPreviewModal(true); 
      } else {
        setResultText(textOutput);
      }
    } catch (primaryError) {
      console.warn("⚠️ Gemini parsing error", primaryError);
      setResultText("Could not generate resume. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  // NATIVE PRINT FUNCTION (Bypasses html2pdf entirely)
  const handleDownloadPDF = () => {
    // Setting the document title renames the downloaded PDF file automatically
    const originalTitle = document.title;
    document.title = `${resumeData?.fullName || 'Resume'}_${cvType.replace(/\s+/g, '_')}`;
    
    // Trigger the native browser print dialog
    window.print();
    
    // Restore original title after printing
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(resultText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 pb-10">
     {/* INJECTED PRINT STYLES */}
      <style>{`
        @media print {
          /* 1. Force the entire page to unroll and become visible */
          html, body, #root {
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            background: white !important;
          }
          
          /* 2. Hide EVERYTHING on the screen except the modal */
          body > *:not(#root) { display: none !important; }
          .print\\:hidden { display: none !important; }
          
          /* 3. Strip all constraints from the modal background so it flows naturally */
          .fixed.inset-0 {
            position: relative !important;
            background: transparent !important;
            overflow: visible !important;
            padding: 0 !important;
            display: block !important;
          }
          
          /* 4. Strip scrollbars and height limits from the inner containers */
          .max-h-\\[95vh\\] { max-height: none !important; }
          .overflow-y-auto { overflow: visible !important; }
          .flex-1 { display: block !important; }
          
          /* 5. Ensure the canvas itself takes up 100% width and drops shadows */
          #resume-print-canvas {
            width: 100% !important;
            max-width: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* 6. Set physical paper margins */
          @page { margin: 15mm; }
        }
      `}</style>

      {/* Left Sidebar */}
      <div className="w-full md:w-80 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shrink-0 shadow-sm print:hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" />
            Select Application
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-none">
          {loadingApps ? (
            <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : applications.length === 0 ? (
            <p className="text-sm text-slate-500 text-center p-4">No saved applications found.</p>
          ) : (
            applications.map(app => (
              <button
                key={app.appId}
                onClick={() => { setSelectedApp(app); setResumeData(null); }}
                className={`w-full text-left p-4 rounded-2xl transition-all ${
                  selectedApp?.appId === app.appId 
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 border' 
                    : 'bg-transparent border-transparent border hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1 block">
                  {app.type}
                </span>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1 mb-1">{app.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {app.organization}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Content Workspace */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm print:hidden">
        {selectedApp ? (
          <>
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{selectedApp.title}</h1>
              <div className="flex items-center gap-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1"><Building2 className="w-4 h-4" /> {selectedApp.organization}</span>
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {selectedApp.country}</span>
              </div>
            </div>

            <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 shrink-0 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl">
                  <button 
                    onClick={() => setPromptType('resume')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${promptType === 'resume' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Resume / CV
                  </button>
                  <button 
                    onClick={() => setPromptType('cover_letter')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${promptType === 'cover_letter' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Cover Letter
                  </button>
                  <button 
                    onClick={() => setPromptType('cold_email')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${promptType === 'cold_email' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Cold Email
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {profiles.length > 0 && (
                    <select 
                      value={selectedProfileId}
                      onChange={(e) => setSelectedProfileId(e.target.value)}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl py-2 px-3 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                    >
                      {profiles.map(p => <option key={p.id} value={p.id}>{p.profile_name}</option>)}
                    </select>
                  )}
                  
                  <button 
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-indigo-500/20"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generating ? 'Drafting...' : promptType === 'resume' ? 'Generate & Preview' : 'Generate'}
                  </button>
                </div>
              </div>

              {promptType === 'resume' && (
                <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Style:</span>
                    <select 
                      value={cvType}
                      onChange={(e) => setCvType(e.target.value)}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg py-1.5 px-3 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                    >
                      <option value="Academic CV">Academic CV</option>
                      <option value="Executive Resume">Executive Resume</option>
                      <option value="Tech & Research CV">Tech & Research CV</option>
                    </select>
                  </div>

                  {resumeData && (
                    <button
                      onClick={() => setShowPreviewModal(true)}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" /> Open Resume Preview
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30 dark:bg-[#0B0F19]/50 relative">
              {promptType === 'resume' && resumeData ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl mb-4 border border-emerald-500/20">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Your Tailored Resume is Ready!</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-6">
                    We crafted a tailored CV based on <strong>{selectedApp.title}</strong>. Preview the document, choose whether to include your photo, and download your PDF.
                  </p>
                  <button
                    onClick={() => setShowPreviewModal(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/30"
                  >
                    <Eye className="w-4 h-4" /> Preview & Download PDF
                  </button>
                </div>
              ) : resultText ? (
                <div className="max-w-3xl mx-auto group">
                  <div className="flex justify-end gap-2 mb-4 sticky top-0 bg-slate-50/80 dark:bg-[#0B0F19]/80 backdrop-blur-sm p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm z-10">
                    <button 
                      onClick={copyToClipboard}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-sm font-medium"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {resultText}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                  <FileText className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-medium">Choose your preferences above and click Generate.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <Sparkles className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-medium text-lg">Select an application from the left</p>
          </div>
        )}
      </div>

      {/* --- LIVE PREVIEW MODAL & PRINTABLE CANVAS --- */}
      {showPreviewModal && resumeData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto print:bg-transparent print:p-0 print:block">
          
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl print:border-none print:rounded-none print:shadow-none print:max-w-none print:max-h-none print:h-auto print:overflow-visible">
            
            {/* Modal Toolbar (Hidden during actual print) */}
            <div className="p-4 sm:px-6 bg-slate-800/80 border-b border-slate-700 flex flex-wrap items-center justify-between gap-4 shrink-0 print:hidden">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm sm:text-base">Document Preview</h3>
                  <p className="text-xs text-slate-400">For best results, select "Save as PDF" in the print window.</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300 bg-slate-700/50 hover:bg-slate-700 px-3 py-2 rounded-xl transition-colors border border-slate-600">
                  <ImageIcon className="w-4 h-4 text-indigo-400" />
                  <span>Include Photo</span>
                  <input
                    type="checkbox"
                    checked={includePhoto}
                    onChange={(e) => setIncludePhoto(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0 cursor-pointer ml-1"
                  />
                </label>

                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-emerald-600/30 transition-all"
                >
                  <Download className="w-4 h-4" /> Confirm & Save PDF
                </button>

                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Container (Natural height when printing) */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-slate-950/70 flex justify-center items-start print:p-0 print:bg-white print:overflow-visible print:block">
              
              {/* THE RESUME ITSELF */}
              <div 
                id="resume-print-canvas"
                className="w-full max-w-[210mm] h-max bg-[#ffffff] text-[#1e293b] p-8 sm:p-12 shadow-2xl print:shadow-none print:w-full print:max-w-none print:p-0"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between border-b-2 border-[#0f172a] pb-6 mb-6 gap-6 break-inside-avoid">
                    <div className="flex-1">
                      <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0f172a] tracking-tight leading-none mb-2">
                        {resumeData.fullName}
                      </h1>
                      <p className="text-sm sm:text-base font-bold text-[#4338ca] tracking-wide uppercase mb-3">
                        {resumeData.professionalTitle}
                      </p>
                      <div className="flex flex-wrap gap-y-1 gap-x-4 text-xs font-medium text-[#475569]">
                        <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-[#94a3b8]" /> {resumeData.email}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-[#94a3b8]" /> {resumeData.location}</span>
                      </div>
                    </div>

                    {includePhoto && activeProfile?.avatar_url && (
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-[#e2e8f0] shadow-sm shrink-0 bg-[#f1f5f9]">
                        <img src={activeProfile.avatar_url} alt="Applicant Photo" className="w-full h-full object-cover" crossOrigin="anonymous" />
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  {resumeData.summary && (
                    <div className="mb-6 break-inside-avoid">
                      <h2 className="text-xs font-extrabold tracking-widest uppercase text-[#94a3b8] mb-2">Executive Summary</h2>
                      <p className="text-xs sm:text-sm text-[#334155] leading-relaxed text-justify">{resumeData.summary}</p>
                    </div>
                  )}

                  {/* Skills Grid */}
                  {resumeData.skills && resumeData.skills.length > 0 && (
                    <div className="mb-6 break-inside-avoid">
                      <h2 className="text-xs font-extrabold tracking-widest uppercase text-[#94a3b8] mb-2">Core Competencies & Expertise</h2>
                      <div className="flex flex-wrap gap-1.5">
                        {resumeData.skills.map((skill, idx) => (
                          <span key={idx} className="bg-[#f1f5f9] text-[#1e293b] text-[11px] font-semibold px-2.5 py-1 rounded border border-[#e2e8f0] print:bg-[#f1f5f9] print:border-[#e2e8f0]">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Experience */}
                  {resumeData.experience && resumeData.experience.length > 0 && (
                    <div className="mb-6">
                      <h2 className="text-xs font-extrabold tracking-widest uppercase text-[#94a3b8] mb-3 flex items-center gap-1.5 break-inside-avoid">
                        <Briefcase className="w-3.5 h-3.5" /> Relevant Experience & Projects
                      </h2>
                      <div className="space-y-4">
                        {resumeData.experience.map((exp, idx) => (
                          <div key={idx} className="break-inside-avoid">
                            <div className="flex justify-between items-baseline mb-1">
                              <h3 className="text-xs sm:text-sm font-bold text-[#0f172a]">{exp.role}</h3>
                              <span className="text-[10px] font-semibold text-[#64748b]">{exp.period}</span>
                            </div>
                            <p className="text-xs font-semibold text-[#4338ca] mb-1.5">{exp.company}</p>
                            <ul className="list-disc list-inside space-y-1 text-xs text-[#475569] leading-relaxed">
                              {exp.highlights?.map((point, pIdx) => (
                                <li key={pIdx} className="text-justify">{point}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {resumeData.education && resumeData.education.length > 0 && (
                    <div className="mb-6">
                      <h2 className="text-xs font-extrabold tracking-widest uppercase text-[#94a3b8] mb-3 flex items-center gap-1.5 break-inside-avoid">
                        <GraduationCap className="w-3.5 h-3.5" /> Academic Background
                      </h2>
                      <div className="space-y-3">
                        {resumeData.education.map((edu, idx) => (
                          <div key={idx} className="flex justify-between items-baseline break-inside-avoid">
                            <div>
                              <h3 className="text-xs sm:text-sm font-bold text-[#0f172a]">{edu.degree}</h3>
                              <p className="text-xs text-[#475569] font-medium">{edu.institution} {edu.honors ? `• ${edu.honors}` : ''}</p>
                            </div>
                            <span className="text-[10px] font-semibold text-[#64748b]">{edu.year}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Awards */}
                  {resumeData.awards && resumeData.awards.length > 0 && (
                    <div className="break-inside-avoid">
                      <h2 className="text-xs font-extrabold tracking-widest uppercase text-[#94a3b8] mb-2 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5" /> Key Distinctions & Awards
                      </h2>
                      <ul className="list-disc list-inside space-y-1 text-xs text-[#475569]">
                        {resumeData.awards.map((award, idx) => (
                          <li key={idx}>{award}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}