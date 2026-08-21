import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../context/AuthContext';
import { 
  User, Mail, MapPin, Globe, 
  BookOpen, Briefcase, FileText, Award, Code, 
  Plus, Trash2, Save, Loader2, Image as ImageIcon, ChevronDown, ChevronUp
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const emptyProfile = {
  profile_name: 'New Profile', full_name: '', contact_email: '', phone: '', location: '',
  website: '', linkedin: '', github: '', bio: '', avatar_url: '',
  research_interests: [], technical_skills: [], education: [], experience: [],
  publications: [], projects: [], awards: [], certifications: [], languages: []
};

export default function Profiles() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Accordion State
  const [openSection, setOpenSection] = useState('basic');

  useEffect(() => {
    if (user) fetchProfiles();
  }, [user]);

  async function fetchProfiles() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
      if (data && data.length > 0) setActiveProfile(data[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        ...activeProfile,
        updated_at: new Date()
      };
      
      const { error } = await supabase.from('user_profiles').upsert(payload);
      if (error) throw error;
      
      alert('Profile saved successfully!');
      fetchProfiles();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        setActiveProfile({ ...activeProfile, avatar_url: data.secure_url });
      }
    } catch (err) {
      console.error(err);
      alert('Error uploading image.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Dynamic Array Handlers
  const addArrayItem = (field, defaultObj) => {
    setActiveProfile(prev => ({ ...prev, [field]: [...(prev[field] || []), defaultObj] }));
  };

  const updateArrayItem = (field, index, key, value) => {
    setActiveProfile(prev => {
      const updatedArray = [...(prev[field] || [])];
      updatedArray[index] = { ...updatedArray[index], [key]: value };
      return { ...prev, [field]: updatedArray };
    });
  };

  const removeArrayItem = (field, index) => {
    setActiveProfile(prev => {
      const updatedArray = [...(prev[field] || [])];
      updatedArray.splice(index, 1);
      return { ...prev, [field]: updatedArray };
    });
  };

  const SectionHeader = ({ title, icon: Icon, sectionKey }) => (
    <button 
      onClick={() => setOpenSection(openSection === sectionKey ? '' : sectionKey)}
      className="w-full flex items-center justify-between p-4 bg-slate-800/80 border border-slate-700/60 rounded-xl hover:bg-slate-700/50 transition-all font-bold text-slate-200"
    >
      <div className="flex items-center gap-3"><Icon className="w-5 h-5 text-indigo-400" /> {title}</div>
      {openSection === sectionKey ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
    </button>
  );

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6 pt-6 px-4">
      
      {/* Header & Profile Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Profile Studio</h1>
          <p className="text-sm text-slate-400 mt-1">Build your comprehensive commercial and academic portfolio.</p>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 shrink-0">
          <button onClick={() => setActiveProfile(emptyProfile)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm">
            <Plus className="w-4 h-4" /> New Profile
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-4 mb-6">
        {profiles.map(p => (
          <button key={p.id} onClick={() => setActiveProfile(p)} className={`px-4 py-2 rounded-xl text-sm font-bold border whitespace-nowrap transition-all ${activeProfile.id === p.id ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-transparent border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
            {p.profile_name}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        
        {/* 1. BASIC INFO & LINKS */}
        <div className="space-y-2">
          <SectionHeader title="Basic Info & Web Links" icon={User} sectionKey="basic" />
          {openSection === 'basic' && (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="shrink-0 flex flex-col items-center gap-4">
                  <div className="w-32 h-32 rounded-full border-4 border-slate-700 overflow-hidden bg-slate-800 flex items-center justify-center relative group">
                    {activeProfile.avatar_url ? <img src={activeProfile.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-slate-500" />}
                    <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      {uploadingImage ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <ImageIcon className="w-6 h-6 text-white" />}
                      <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                    </label>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-400 mb-1">Profile Category Name</label><input type="text" value={activeProfile.profile_name} onChange={e => setActiveProfile({...activeProfile, profile_name: e.target.value})} className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-slate-400 mb-1">Full Legal Name</label><input type="text" value={activeProfile.full_name} onChange={e => setActiveProfile({...activeProfile, full_name: e.target.value})} className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-slate-400 mb-1">Contact Email</label><input type="email" value={activeProfile.contact_email} onChange={e => setActiveProfile({...activeProfile, contact_email: e.target.value})} className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-slate-400 mb-1">Phone Number</label><input type="text" value={activeProfile.phone} onChange={e => setActiveProfile({...activeProfile, phone: e.target.value})} className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-slate-400 mb-1">Location</label><input type="text" value={activeProfile.location} onChange={e => setActiveProfile({...activeProfile, location: e.target.value})} className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-slate-400 mb-1">LinkedIn URL</label><input type="text" value={activeProfile.linkedin} onChange={e => setActiveProfile({...activeProfile, linkedin: e.target.value})} className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-slate-400 mb-1">GitHub URL</label><input type="text" value={activeProfile.github} onChange={e => setActiveProfile({...activeProfile, github: e.target.value})} className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-slate-400 mb-1">Personal Website</label><input type="text" value={activeProfile.website} onChange={e => setActiveProfile({...activeProfile, website: e.target.value})} className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-indigo-500" /></div>
                </div>
              </div>
              <div><label className="block text-xs font-bold text-slate-400 mb-1">Executive Summary / Bio</label><textarea rows={3} value={activeProfile.bio} onChange={e => setActiveProfile({...activeProfile, bio: e.target.value})} className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-indigo-500 resize-none" /></div>
            </div>
          )}
        </div>

        {/* 2. EDUCATION */}
        <div className="space-y-2">
          <SectionHeader title="Education & Academic Background" icon={BookOpen} sectionKey="education" />
          {openSection === 'education' && (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              {activeProfile.education?.map((edu, idx) => (
                <div key={idx} className="relative p-4 bg-slate-800 border border-slate-700 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button onClick={() => removeArrayItem('education', idx)} className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  <input type="text" placeholder="Degree (e.g. PhD Computer Science)" value={edu.degree} onChange={(e) => updateArrayItem('education', idx, 'degree', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" />
                  <input type="text" placeholder="Institution" value={edu.institution} onChange={(e) => updateArrayItem('education', idx, 'institution', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" />
                  <input type="text" placeholder="Period (e.g. 2018 - 2022)" value={edu.period} onChange={(e) => updateArrayItem('education', idx, 'period', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" />
                  <input type="text" placeholder="Honors / GPA" value={edu.honors} onChange={(e) => updateArrayItem('education', idx, 'honors', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" />
                  <div className="md:col-span-2"><input type="text" placeholder="Thesis Title" value={edu.thesis} onChange={(e) => updateArrayItem('education', idx, 'thesis', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" /></div>
                </div>
              ))}
              <button onClick={() => addArrayItem('education', { degree: '', institution: '', period: '', honors: '', thesis: '' })} className="text-xs font-bold text-indigo-400 flex items-center gap-1 hover:text-indigo-300"><Plus className="w-4 h-4" /> Add Education</button>
            </div>
          )}
        </div>

        {/* 3. EXPERIENCE */}
        <div className="space-y-2">
          <SectionHeader title="Experience (Work, Research & Teaching)" icon={Briefcase} sectionKey="experience" />
          {openSection === 'experience' && (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              {activeProfile.experience?.map((exp, idx) => (
                <div key={idx} className="relative p-4 bg-slate-800 border border-slate-700 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button onClick={() => removeArrayItem('experience', idx)} className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  <select value={exp.type || 'Work'} onChange={(e) => updateArrayItem('experience', idx, 'type', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none">
                    <option value="Work">Corporate / Work</option>
                    <option value="Research">Research Lab</option>
                    <option value="Teaching">Teaching / TA</option>
                  </select>
                  <input type="text" placeholder="Role Title" value={exp.role} onChange={(e) => updateArrayItem('experience', idx, 'role', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" />
                  <input type="text" placeholder="Organization / Company" value={exp.organization} onChange={(e) => updateArrayItem('experience', idx, 'organization', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" />
                  <input type="text" placeholder="Period (e.g. Aug 2021 - Present)" value={exp.period} onChange={(e) => updateArrayItem('experience', idx, 'period', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" />
                  <div className="md:col-span-2"><textarea rows={3} placeholder="Description or bullet points (separate by newline)" value={exp.description} onChange={(e) => updateArrayItem('experience', idx, 'description', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none resize-none" /></div>
                </div>
              ))}
              <button onClick={() => addArrayItem('experience', { type: 'Work', role: '', organization: '', period: '', description: '' })} className="text-xs font-bold text-indigo-400 flex items-center gap-1 hover:text-indigo-300"><Plus className="w-4 h-4" /> Add Experience</button>
            </div>
          )}
        </div>

        {/* 4. PUBLICATIONS */}
        <div className="space-y-2">
          <SectionHeader title="Publications (Journals, Conferences, Books)" icon={FileText} sectionKey="publications" />
          {openSection === 'publications' && (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              {activeProfile.publications?.map((pub, idx) => (
                <div key={idx} className="relative p-4 bg-slate-800 border border-slate-700 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button onClick={() => removeArrayItem('publications', idx)} className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  <select value={pub.type || 'Journal Article'} onChange={(e) => updateArrayItem('publications', idx, 'type', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none">
                    <option value="Journal Article">Journal Article</option>
                    <option value="Conference Paper">Conference Paper</option>
                    <option value="Book Chapter">Book Chapter</option>
                    <option value="Patent">Patent</option>
                  </select>
                  <input type="text" placeholder="Title" value={pub.title} onChange={(e) => updateArrayItem('publications', idx, 'title', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" />
                  <input type="text" placeholder="Venue / Journal Name" value={pub.venue} onChange={(e) => updateArrayItem('publications', idx, 'venue', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" />
                  <input type="text" placeholder="Year & Status (e.g. 2023 - Published)" value={pub.year} onChange={(e) => updateArrayItem('publications', idx, 'year', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" />
                  <div className="md:col-span-2"><input type="text" placeholder="Authors (e.g. Smith, J., Doe, A.)" value={pub.authors} onChange={(e) => updateArrayItem('publications', idx, 'authors', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" /></div>
                </div>
              ))}
              <button onClick={() => addArrayItem('publications', { type: 'Journal Article', title: '', venue: '', year: '', authors: '' })} className="text-xs font-bold text-indigo-400 flex items-center gap-1 hover:text-indigo-300"><Plus className="w-4 h-4" /> Add Publication</button>
            </div>
          )}
        </div>

        {/* 5. PROJECTS & PRODUCTS */}
        <div className="space-y-2">
          <SectionHeader title="Projects (Final Year, Products, Open Source)" icon={Code} sectionKey="projects" />
          {openSection === 'projects' && (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              {activeProfile.projects?.map((proj, idx) => (
                <div key={idx} className="relative p-4 bg-slate-800 border border-slate-700 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button onClick={() => removeArrayItem('projects', idx)} className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  <select value={proj.type || 'Final Year Project'} onChange={(e) => updateArrayItem('projects', idx, 'type', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none">
                    <option value="Final Year Project">Final Year Project</option>
                    <option value="Product">Commercial Product</option>
                    <option value="Open Source">Open Source Contribution</option>
                  </select>
                  <input type="text" placeholder="Project Name" value={proj.name} onChange={(e) => updateArrayItem('projects', idx, 'name', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" />
                  <input type="text" placeholder="Your Role / Tech Stack" value={proj.role} onChange={(e) => updateArrayItem('projects', idx, 'role', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" />
                  <input type="text" placeholder="URL / Link (Optional)" value={proj.url} onChange={(e) => updateArrayItem('projects', idx, 'url', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" />
                  <div className="md:col-span-2"><textarea rows={2} placeholder="Description" value={proj.description} onChange={(e) => updateArrayItem('projects', idx, 'description', e.target.value)} className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none resize-none" /></div>
                </div>
              ))}
              <button onClick={() => addArrayItem('projects', { type: 'Final Year Project', name: '', role: '', url: '', description: '' })} className="text-xs font-bold text-indigo-400 flex items-center gap-1 hover:text-indigo-300"><Plus className="w-4 h-4" /> Add Project</button>
            </div>
          )}
        </div>

        {/* 6. SKILLS & INTERESTS */}
        <div className="space-y-2">
          <SectionHeader title="Technical Skills & Research Interests" icon={Award} sectionKey="skills" />
          {openSection === 'skills' && (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white mb-2">Technical & Soft Skills</h3>
                {activeProfile.technical_skills?.map((skillSet, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input type="text" placeholder="Category (e.g. Languages, Frameworks)" value={skillSet.category} onChange={(e) => updateArrayItem('technical_skills', idx, 'category', e.target.value)} className="w-1/3 bg-slate-800 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" />
                    <input type="text" placeholder="Skills (comma separated)" value={skillSet.skills} onChange={(e) => updateArrayItem('technical_skills', idx, 'skills', e.target.value)} className="flex-1 bg-slate-800 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" />
                    <button onClick={() => removeArrayItem('technical_skills', idx)} className="p-2 text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button onClick={() => addArrayItem('technical_skills', { category: '', skills: '' })} className="text-xs font-bold text-indigo-400 flex items-center gap-1 hover:text-indigo-300 mt-2"><Plus className="w-4 h-4" /> Add Skill Category</button>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-2">Research Interests</h3>
                {activeProfile.research_interests?.map((interest, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input type="text" placeholder="e.g. Deep Learning, Climate Policy" value={interest.name || ''} onChange={(e) => updateArrayItem('research_interests', idx, 'name', e.target.value)} className="flex-1 bg-slate-800 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" />
                    <button onClick={() => removeArrayItem('research_interests', idx)} className="p-2 text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button onClick={() => addArrayItem('research_interests', { name: '' })} className="text-xs font-bold text-indigo-400 flex items-center gap-1 hover:text-indigo-300 mt-2"><Plus className="w-4 h-4" /> Add Interest</button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Save Button Float */}
      <div className="sticky bottom-6 mt-8 flex justify-end">
        <button onClick={handleSaveProfile} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3.5 rounded-2xl font-extrabold text-sm flex items-center gap-2 shadow-xl shadow-emerald-900/50 transition-all">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Save Complete Profile
        </button>
      </div>

    </div>
  );
}