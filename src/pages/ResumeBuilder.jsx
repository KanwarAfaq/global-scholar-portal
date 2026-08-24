import React, { useState, useEffect } from 'react';
import { 
  Document, Page, Text, View, Image as PDFImage, 
  StyleSheet, PDFViewer, PDFDownloadLink 
} from '@react-pdf/renderer';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAuth } from '../context/AuthContext';
import { 
  Sparkles, Eye, EyeOff, Plus, Trash2, Download, 
  RefreshCw, CheckCircle2, FileText, Briefcase, 
  GraduationCap, Palette, Building2, Code, BookOpen,
  Award, Globe, Microscope, BadgeCheck, Contact
} from 'lucide-react';

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ==========================================
// 🎨 TEMPLATES (Modern, Minimalist, Academic)
// ==========================================
const modernStyles = StyleSheet.create({
  page: { padding: 35, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF', color: '#1E293B' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#4F46E5', paddingBottom: 15, marginBottom: 15 },
  headerInfo: { flex: 1, paddingRight: 10 },
  name: { fontSize: 24, fontWeight: 'bold', color: '#0F172A', textTransform: 'uppercase' },
  title: { fontSize: 11, color: '#4F46E5', fontWeight: 'bold', marginTop: 3, textTransform: 'uppercase' },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6, fontSize: 9, color: '#64748B' },
  avatar: { width: 65, height: 65, borderRadius: 32, borderWidth: 1, borderColor: '#CBD5E1' },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#4F46E5', textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 3, marginTop: 12, marginBottom: 6 },
  summaryText: { fontSize: 9, lineHeight: 1.4, color: '#334155', textAlign: 'justify' },
  itemContainer: { marginBottom: 8 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  itemTitle: { fontSize: 10, fontWeight: 'bold', color: '#0F172A' },
  itemDate: { fontSize: 8, color: '#64748B' },
  itemSub: { fontSize: 9, color: '#4F46E5', fontStyle: 'italic', marginBottom: 2 },
  bullet: { fontSize: 8.5, color: '#475569', lineHeight: 1.3, marginLeft: 8, marginBottom: 2 },
  skillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  skillBadge: { backgroundColor: '#F1F5F9', color: '#1E293B', fontSize: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, borderWidth: 1, borderColor: '#E2E8F0' }
});

const minimalStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF', color: '#111827' },
  header: { textAlign: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#111827', paddingBottom: 12 },
  headerInfo: { alignItems: 'center' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#111827', letterSpacing: 1 },
  title: { fontSize: 10, color: '#4B5563', marginTop: 4 },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 6, fontSize: 8.5, color: '#6B7280' },
  avatar: { width: 50, height: 50, borderRadius: 25, alignSelf: 'center', marginBottom: 6 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: '#111827', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB', paddingBottom: 2, marginTop: 12, marginBottom: 6 },
  summaryText: { fontSize: 8.5, lineHeight: 1.4, color: '#374151', textAlign: 'justify' },
  itemContainer: { marginBottom: 8 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  itemTitle: { fontSize: 9.5, fontWeight: 'bold', color: '#111827' },
  itemDate: { fontSize: 8, color: '#6B7280' },
  itemSub: { fontSize: 8.5, color: '#4B5563', marginBottom: 2 },
  bullet: { fontSize: 8.5, color: '#374151', marginLeft: 6, marginBottom: 2 },
  skillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillBadge: { fontSize: 8.5, color: '#111827' }
});

const academicStyles = StyleSheet.create({
  page: { padding: 35, fontFamily: 'Times-Roman', backgroundColor: '#FFFFFF', color: '#000000' },
  header: { borderBottomWidth: 1.5, borderBottomColor: '#000000', paddingBottom: 10, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerInfo: { flex: 1 },
  name: { fontSize: 20, fontWeight: 'bold', color: '#000000' },
  title: { fontSize: 10, fontStyle: 'italic', marginTop: 2 },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4, fontSize: 8.5, color: '#333333' },
  avatar: { width: 55, height: 55, borderWidth: 1, borderColor: '#000000' },
  sectionTitle: { fontSize: 10.5, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 10, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#666666' },
  summaryText: { fontSize: 9, lineHeight: 1.3, textAlign: 'justify' },
  itemContainer: { marginBottom: 6 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  itemTitle: { fontSize: 9.5, fontWeight: 'bold' },
  itemDate: { fontSize: 8.5, fontStyle: 'italic' },
  itemSub: { fontSize: 9, fontStyle: 'italic', marginBottom: 1 },
  bullet: { fontSize: 8.5, marginLeft: 10, marginBottom: 1 },
  skillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  skillBadge: { fontSize: 8.5 }
});

// ==========================================
// 📄 DYNAMIC PDF DOCUMENT RENDERER
// ==========================================
const UniversalResumePDF = ({ data, templateId }) => {
  let s = modernStyles;
  if (templateId === 'minimal') s = minimalStyles;
  if (templateId === 'academic') s = academicStyles;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        
        {/* HEADER */}
        <View style={s.header}>
          <View style={s.headerInfo}>
            <Text style={s.name}>{data.personal.fullName || 'Full Name'}</Text>
            {data.personal.showTitle && data.personal.title && <Text style={s.title}>{data.personal.title}</Text>}
            <View style={s.contactRow}>
              {data.personal.showEmail && data.personal.email && <Text>{data.personal.email}</Text>}
              {data.personal.showPhone && data.personal.phone && <Text>• {data.personal.phone}</Text>}
              {data.personal.showLocation && data.personal.location && <Text>• {data.personal.location}</Text>}
              {data.personal.showLinkedin && data.personal.linkedin && <Text>• {data.personal.linkedin}</Text>}
              {data.personal.showGithub && data.personal.github && <Text>• {data.personal.github}</Text>}
              {data.personal.showWebsite && data.personal.website && <Text>• {data.personal.website}</Text>}
            </View>
          </View>
          {data.personal.showPhoto && data.personal.avatar_url && (
            <PDFImage src={data.personal.avatar_url} style={s.avatar} />
          )}
        </View>

        {/* SUMMARY */}
        {data.summary.visible && data.summary.text && (
          <View style={{ marginBottom: 6 }}>
            <Text style={s.sectionTitle}>Professional Summary</Text>
            <Text style={s.summaryText}>{data.summary.text}</Text>
          </View>
        )}

        {/* EXPERIENCE */}
        {data.experience.some(item => item.visible) && (
          <View style={{ marginBottom: 6 }}>
            <Text style={s.sectionTitle}>Experience & Research</Text>
            {data.experience.filter(item => item.visible).map((exp, idx) => (
              <View key={idx} style={s.itemContainer}>
                <View style={s.itemHeader}>
                  <Text style={s.itemTitle}>{exp.role}</Text>
                  <Text style={s.itemDate}>{exp.period}</Text>
                </View>
                {exp.company && <Text style={s.itemSub}>{exp.company}</Text>}
                {exp.highlights?.map((point, pIdx) => (
                  <Text key={pIdx} style={s.bullet}>• {point}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* PROJECTS & PRODUCTS */}
        {data.projects && data.projects.some(item => item.visible) && (
          <View style={{ marginBottom: 6 }}>
            <Text style={s.sectionTitle}>Projects & Products</Text>
            {data.projects.filter(item => item.visible).map((proj, idx) => (
              <View key={idx} style={s.itemContainer}>
                <View style={s.itemHeader}>
                  <Text style={s.itemTitle}>{proj.name}</Text>
                  <Text style={s.itemDate}>{proj.role}</Text>
                </View>
                <Text style={s.bullet}>• {proj.description}</Text>
              </View>
            ))}
          </View>
        )}

        {/* PUBLICATIONS */}
        {data.publications && data.publications.some(item => item.visible) && (
          <View style={{ marginBottom: 6 }}>
            <Text style={s.sectionTitle}>Publications</Text>
            {data.publications.filter(item => item.visible).map((pub, idx) => (
              <View key={idx} style={s.itemContainer}>
                <View style={s.itemHeader}>
                  <Text style={s.itemTitle}>{pub.title}</Text>
                  <Text style={s.itemDate}>{pub.year}</Text>
                </View>
                <Text style={s.itemSub}>{pub.venue} • {pub.authors}</Text>
              </View>
            ))}
          </View>
        )}

        {/* EDUCATION */}
        {data.education.some(item => item.visible) && (
          <View style={{ marginBottom: 6 }}>
            <Text style={s.sectionTitle}>Education</Text>
            {data.education.filter(item => item.visible).map((edu, idx) => (
              <View key={idx} style={s.itemContainer}>
                <View style={s.itemHeader}>
                  <Text style={s.itemTitle}>{edu.degree}</Text>
                  <Text style={s.itemDate}>{edu.year}</Text>
                </View>
                <Text style={s.itemSub}>{edu.institution} {edu.honors ? `• ${edu.honors}` : ''}</Text>
              </View>
            ))}
          </View>
        )}

        {/* AWARDS & HONORS */}
        {data.awards && data.awards.some(item => item.visible) && (
          <View style={{ marginBottom: 6 }}>
            <Text style={s.sectionTitle}>Awards & Honors</Text>
            {data.awards.filter(item => item.visible).map((awd, idx) => (
              <View key={idx} style={s.itemContainer}>
                <View style={s.itemHeader}>
                  <Text style={s.itemTitle}>{awd.name}</Text>
                  <Text style={s.itemDate}>{awd.year}</Text>
                </View>
                {awd.issuer && <Text style={s.itemSub}>{awd.issuer}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* CERTIFICATIONS */}
        {data.certifications && data.certifications.some(item => item.visible) && (
          <View style={{ marginBottom: 6 }}>
            <Text style={s.sectionTitle}>Certifications</Text>
            {data.certifications.filter(item => item.visible).map((cert, idx) => (
              <View key={idx} style={s.itemContainer}>
                <View style={s.itemHeader}>
                  <Text style={s.itemTitle}>{cert.name}</Text>
                  <Text style={s.itemDate}>{cert.year}</Text>
                </View>
                {cert.issuer && <Text style={s.itemSub}>{cert.issuer}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* RESEARCH INTERESTS */}
        {data.researchInterests && data.researchInterests.some(item => item.visible) && (
          <View style={{ marginBottom: 6 }}>
            <Text style={s.sectionTitle}>Research Interests</Text>
            <View style={s.skillsContainer}>
              {data.researchInterests.filter(i => i.visible).map((interest, idx) => (
                <Text key={idx} style={s.skillBadge}>{interest.name}</Text>
              ))}
            </View>
          </View>
        )}

        {/* TECHNICAL SKILLS */}
        {data.skills.some(skill => skill.visible) && (
          <View style={{ marginBottom: 6 }}>
            <Text style={s.sectionTitle}>Core Competencies & Skills</Text>
            <View style={s.skillsContainer}>
              {data.skills.filter(sItem => sItem.visible).map((skill, idx) => (
                <Text key={idx} style={s.skillBadge}>
                  {templateId === 'minimal' ? `• ${skill.name}` : skill.name}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* LANGUAGES */}
        {data.languages && data.languages.some(item => item.visible) && (
          <View style={{ marginBottom: 6 }}>
            <Text style={s.sectionTitle}>Languages</Text>
            <View style={s.skillsContainer}>
              {data.languages.filter(l => l.visible).map((lang, idx) => (
                <Text key={idx} style={s.skillBadge}>{lang.name} ({lang.proficiency})</Text>
              ))}
            </View>
          </View>
        )}

        {/* CUSTOM SECTIONS */}
        {data.customSections.some(sec => sec.visible) && (
          <View>
            <Text style={s.sectionTitle}>Additional Information</Text>
            {data.customSections.filter(sec => sec.visible).map((sec, idx) => (
              <View key={idx} style={s.itemContainer}>
                <Text style={s.itemTitle}>{sec.title}</Text>
                {sec.detail && <Text style={s.bullet}>• {sec.detail}</Text>}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
};

// ==========================================
// 🖥️ MAIN RESUME BUILDER COMPONENT
// ==========================================
export default function ResumeBuilder() {
  const { user } = useAuth();
  
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('modern');

  // Comprehensive Master Resume Data State
  const [resumeData, setResumeData] = useState({
    personal: { 
      fullName: '', title: 'Specialist', 
      email: '', showEmail: true,
      phone: '', showPhone: true,
      location: '', showLocation: true,
      linkedin: '', showLinkedin: true,
      github: '', showGithub: true,
      website: '', showWebsite: true,
      avatar_url: '', showPhoto: true, 
      showTitle: true 
    },
    summary: { text: '', visible: true },
    skills: [], experience: [], education: [], projects: [], publications: [],
    awards: [], certifications: [], languages: [], researchInterests: [], customSections: []
  });

  const [newTitle, setNewTitle] = useState('');
  const [newDetail, setNewDetail] = useState('');

  useEffect(() => {
    if (user) {
      fetchProfiles();
      fetchSavedApplications();
    }
  }, [user]);

  async function fetchProfiles() {
    try {
      const { data, error } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) {
        setProfiles(data);
        setSelectedProfileId(data[0].id);
        populateFromProfile(data[0]);
      }
    } catch (err) { console.error('Failed to load profiles:', err); }
  }

  async function fetchSavedApplications() {
    try {
      const { data, error } = await supabase.from('user_applications').select('id, status, global_opportunities(*)');
      if (error) throw error;
      const formattedApps = data.filter(app => app.global_opportunities).map(app => ({ appId: app.id, status: app.status, ...app.global_opportunities }));
      setApplications(formattedApps);
      if (formattedApps.length > 0) setSelectedApp(formattedApps[0]);
    } catch (err) { console.error('Error fetching apps:', err.message); }
  }

  // Parses DB data perfectly into Resume State
  const populateFromProfile = (profile) => {
    if (!profile) return;
    
    const parseArray = (arr) => Array.isArray(arr) ? arr : [];

    let parsedSkills = [];
    if (profile.technical_skills && Array.isArray(profile.technical_skills)) {
      profile.technical_skills.forEach((ts, idx) => {
        if (ts.skills) ts.skills.split(',').forEach((s, sIdx) => parsedSkills.push({ id: `sk_${idx}_${sIdx}`, name: s.trim(), visible: true }));
      });
    } else if (profile.skills && typeof profile.skills === 'string') {
      parsedSkills = profile.skills.split(',').map((s, i) => ({ id: `sk_${i}`, name: s.trim(), visible: true })).filter(s => s.name);
    }

    setResumeData(prev => ({
      ...prev,
      personal: {
        ...prev.personal, // Keeps previous toggle states if re-fetching
        fullName: profile.full_name || 'Candidate Name',
        title: profile.profile_name || 'Specialist',
        email: profile.contact_email || user?.email || '',
        phone: profile.phone || '',
        location: profile.location || 'Global',
        linkedin: profile.linkedin || '',
        github: profile.github || '',
        website: profile.website || '',
        avatar_url: profile.avatar_url || '',
        showPhoto: Boolean(profile.avatar_url),
        showTitle: true
      },
      summary: { text: profile.bio || '', visible: true },
      skills: parsedSkills,
      experience: parseArray(profile.experience).map((exp, i) => ({ id: `exp_${i}`, role: exp.role, company: exp.organization, period: exp.period, highlights: exp.description ? exp.description.split('\n').filter(Boolean) : [], visible: true })),
      education: parseArray(profile.education).map((edu, i) => ({ id: `edu_${i}`, degree: edu.degree, institution: edu.institution, year: edu.period, honors: edu.honors, visible: true })),
      projects: parseArray(profile.projects).map((proj, i) => ({ id: `proj_${i}`, name: proj.name, role: proj.role, description: proj.description, visible: true })),
      publications: parseArray(profile.publications).map((pub, i) => ({ id: `pub_${i}`, title: pub.title, venue: pub.venue, year: pub.year, authors: pub.authors, visible: true })),
      awards: parseArray(profile.awards).map((awd, i) => ({ id: `awd_${i}`, name: awd.name, issuer: awd.issuer, year: awd.year, visible: true })),
      certifications: parseArray(profile.certifications).map((cert, i) => ({ id: `cert_${i}`, name: cert.name, issuer: cert.issuer, year: cert.year, visible: true })),
      languages: parseArray(profile.languages).map((lang, i) => ({ id: `lang_${i}`, name: lang.name, proficiency: lang.proficiency, visible: true })),
      researchInterests: parseArray(profile.research_interests).map((int, i) => ({ id: `int_${i}`, name: int.name, visible: true }))
    }));
  };

  const handleProfileChange = (e) => {
    const pId = e.target.value;
    setSelectedProfileId(pId);
    const chosen = profiles.find(p => p.id === pId);
    if (chosen) populateFromProfile(chosen);
  };

  // 3-Tier AI Generator (Feeds 100% of profile context to the AI)
  // 4-Tier "Unbreakable" AI Generator
  // 4-Tier "Unbreakable" AI Generator (CGU Primary)
  // 4-Tier AI Generator (CGU 4o -> CGU Local 20b -> Groq -> Gemini)
  const handleGenerateAI = async () => {
    setGeneratingAI(true);

    const prompt = `You are an elite ATS resume optimizer.
    
CANDIDATE DATA:
Name: ${resumeData.personal.fullName}
Summary: ${resumeData.summary.text}
Skills: ${resumeData.skills.map(s => s.name).join(', ')}
Experience: ${JSON.stringify(resumeData.experience)}
Projects: ${JSON.stringify(resumeData.projects)}

TARGET OPPORTUNITY:
Position: ${selectedApp?.title || 'General Position'}
Organization: ${selectedApp?.organization || 'Target Organization'}
Requirements: ${selectedApp?.tags ? selectedApp.tags.join(', ') : 'Not specified'}

TASK: 
1. Write a masterful 3-sentence summary highlighting why this candidate is perfect for this specific role.
2. Rewrite the Experience and Projects bullet points to align with the target opportunity requirements. Use strong action verbs.
3. Extract and organize the most relevant Skills.

Return ONLY valid JSON (no markdown formatting, no backticks, no comments):
{
  "title": "Professional Title (Tailored)",
  "summary": "Tailored 3-sentence summary",
  "skills": ["Skill 1", "Skill 2"],
  "experience": [{"role": "Title", "company": "Org", "period": "Date", "highlights": ["Optimized bullet 1", "Optimized bullet 2"]}],
  "projects": [{"name": "Proj Name", "role": "Role", "description": "Tailored description mapping to job requirements"}]
}`;

    let jsonText = "";

    // 🟢 TIER 1A: CGU Institutional Gateway (GPT-4o)
    try {
      console.log("Attempting CGU Gateway GPT-4o (Tier 1A)...");
      const cguKey = import.meta.env.VITE_CGU_API_KEY;
      if (!cguKey) throw new Error("VITE_CGU_API_KEY is not defined in .env");

      const cguRes = await fetch('/cgullmapi/v1/chat/completions', {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${cguKey}` 
        },
        body: JSON.stringify({ 
          model: "gpt-4o", 
          messages: [
            { role: "system", content: "You output valid JSON only." }, 
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" } 
        })
      });
      
      if (!cguRes.ok) throw new Error(await cguRes.text());
      jsonText = (await cguRes.json()).choices[0].message.content;
      console.log("✅ CGU Gateway GPT-4o Succeeded!");

    } catch (err1a) {
      console.warn("CGU GPT-4o Failed, attempting CGU Local Model (Tier 1B)...", err1a.message);
      
      // 🟢 TIER 1B: CGU Local Model (gpt-oss:20b - Free Quota)
      try {
        const cguKey = import.meta.env.VITE_CGU_API_KEY;
        if (!cguKey) throw new Error("VITE_CGU_API_KEY is not defined in .env");

        const cguLocalRes = await fetch('https://air.cgu.edu.tw/cgullmapi/v1/chat/completions', {
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${cguKey}` 
          },
          body: JSON.stringify({ 
            model: "gpt-oss:20b", 
            messages: [
              { role: "system", content: "You output valid JSON only." }, 
              { role: "user", content: prompt }
            ]
          })
        });

        if (!cguLocalRes.ok) throw new Error(await cguLocalRes.text());
        jsonText = (await cguLocalRes.json()).choices[0].message.content;
        console.log("✅ CGU Local Model Succeeded!");

      } catch (err1b) {
        console.warn("CGU Local Model Failed, attempting Groq (Tier 2)...", err1b.message);
        
        // 🟡 TIER 2: Groq Fallback
        try {
          const groqKey = import.meta.env.VITE_GROQ_API_KEY;
          if (!groqKey) throw new Error("VITE_GROQ_API_KEY is not defined in .env");

          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST', 
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${groqKey}` 
            },
            body: JSON.stringify({ 
              model: "openai/gpt-oss-120b", 
              messages: [
                { role: "system", content: "You output valid JSON only. Do not wrap in markdown. Begin immediately with {" }, 
                { role: "user", content: prompt }
              ]
            })
          });
          
          if (!groqRes.ok) throw new Error(await groqRes.text());
          jsonText = (await groqRes.json()).choices[0].message.content;
          console.log("✅ Groq Succeeded!");

        } catch (err2) {
          console.warn("Groq Failed, attempting Gemini (Tier 3)...", err2.message);
          
          // 🟠 TIER 3: Gemini Fallback
          try {
            const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!geminiKey) throw new Error("VITE_GEMINI_API_KEY is missing");

            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            jsonText = (await model.generateContent(prompt)).response.text();
            console.log("✅ Gemini Succeeded!");
            
          } catch (err3) {
            console.error("All APIs failed:", err3.message);
            alert("AI Generation failed across all networks. Please try again later.");
            setGeneratingAI(false); 
            return;
          }
        }
      }
    }

    try {
      const parsed = JSON.parse(jsonText.replace(/```json/gi, '').replace(/```/g, '').trim());
      
      setResumeData(prev => ({
        ...prev, 
        personal: { ...prev.personal, title: parsed.title || prev.personal.title },
        summary: { text: parsed.summary || prev.summary.text, visible: true },
        skills: (parsed.skills || []).map((s, i) => ({ id: `ai_sk_${i}`, name: s, visible: true })),
        experience: (parsed.experience || []).map((exp, i) => ({ id: `ai_exp_${i}`, ...exp, visible: true })),
        projects: (parsed.projects || prev.projects).map((proj, i) => ({ id: `ai_proj_${i}`, ...proj, visible: true }))
      }));
      
    } catch (e) {
      console.error("JSON parsing error:", e, jsonText);
      alert("AI returned invalid JSON. Please try generating again.");
    } finally {
      setGeneratingAI(false);
    }
  };

  const toggleArrayItem = (field, id) => {
    setResumeData(prev => ({ ...prev, [field]: prev[field].map(item => item.id === id ? { ...item, visible: !item.visible } : item) }));
  };

  const togglePersonalItem = (key) => {
    setResumeData(prev => ({ ...prev, personal: { ...prev.personal, [key]: !prev.personal[key] } }));
  };

  const ToggleList = ({ title, icon: Icon, field, dataArray, renderContent }) => (
    dataArray && dataArray.length > 0 && (
      <div className="space-y-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-700/40">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
          <Icon className="w-3.5 h-3.5" /> {title}
        </h2>
        <div className="space-y-2">
          {dataArray.map(item => (
            <div key={item.id} className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${item.visible ? 'bg-slate-800 border-slate-700' : 'bg-slate-900/60 border-slate-800 opacity-50'}`}>
              <div>{renderContent(item)}</div>
              <button onClick={() => toggleArrayItem(field, item.id)} className="text-slate-400 hover:text-white p-1 shrink-0">
                {item.visible ? <Eye className="w-4 h-4 text-indigo-400" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-5.5rem)] min-h-screen lg:min-h-0 p-4 lg:p-6 bg-slate-900 text-slate-100">
      
      {/* 🛠️ LEFT PANEL: CONTROLS & CHECKBOXES */}
      <div className="w-full lg:w-5/12 bg-slate-800/80 border border-slate-700/60 rounded-3xl p-5 overflow-y-auto space-y-5 shrink-0 shadow-xl scrollbar-none">
        
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 text-indigo-400" /> Resume Studio
          </h1>
          <p className="text-xs text-slate-400 mb-4">Toggle items and select templates to build your document.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-700/50 mb-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Active Profile</label>
              <select value={selectedProfileId} onChange={handleProfileChange} className="w-full bg-slate-800 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer">
                {profiles.map(p => <option key={p.id} value={p.id}>{p.profile_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                <Palette className="w-3 h-3 text-indigo-400" /> Template Style
              </label>
              <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} className="w-full bg-slate-800 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer">
                <option value="modern">Modern Indigo</option>
                <option value="minimal">Clean Minimalist</option>
                <option value="academic">Academic & Research</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-700/50">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-indigo-400" /> Target Opportunity
            </label>
            <select value={selectedApp?.appId || ''} onChange={(e) => setSelectedApp(applications.find(a => a.appId === e.target.value))} className="w-full bg-slate-800 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer">
              {applications.length === 0 && <option value="">No saved applications found</option>}
              {applications.map(app => <option key={app.appId} value={app.appId}>{app.title} at {app.organization}</option>)}
            </select>
          </div>
        </div>

        <button onClick={handleGenerateAI} disabled={generatingAI || !selectedApp} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50">
          {generatingAI ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generatingAI ? 'AI is tailoring resume...' : '✨ Tailor Resume to Selected Opportunity'}
        </button>

        {/* ===================================== */}
        {/* NEW: GRANULAR CONTACT & BASIC TOGGLES */}
        {/* ===================================== */}
        <div className="space-y-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-700/40">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
            <Contact className="w-3.5 h-3.5" /> Header & Contact Info
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
              <input type="checkbox" checked={resumeData.personal.showPhoto} onChange={() => togglePersonalItem('showPhoto')} className="rounded bg-slate-700 border-slate-600 text-indigo-600" /> Photo Avatar
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
              <input type="checkbox" checked={resumeData.personal.showTitle} onChange={() => togglePersonalItem('showTitle')} className="rounded bg-slate-700 border-slate-600 text-indigo-600" /> Professional Title
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
              <input type="checkbox" checked={resumeData.personal.showEmail} onChange={() => togglePersonalItem('showEmail')} className="rounded bg-slate-700 border-slate-600 text-indigo-600" /> Email Address
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
              <input type="checkbox" checked={resumeData.personal.showPhone} onChange={() => togglePersonalItem('showPhone')} className="rounded bg-slate-700 border-slate-600 text-indigo-600" /> Phone Number
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
              <input type="checkbox" checked={resumeData.personal.showLocation} onChange={() => togglePersonalItem('showLocation')} className="rounded bg-slate-700 border-slate-600 text-indigo-600" /> Location
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
              <input type="checkbox" checked={resumeData.personal.showLinkedin} onChange={() => togglePersonalItem('showLinkedin')} className="rounded bg-slate-700 border-slate-600 text-indigo-600" /> LinkedIn
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
              <input type="checkbox" checked={resumeData.personal.showGithub} onChange={() => togglePersonalItem('showGithub')} className="rounded bg-slate-700 border-slate-600 text-indigo-600" /> GitHub
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
              <input type="checkbox" checked={resumeData.personal.showWebsite} onChange={() => togglePersonalItem('showWebsite')} className="rounded bg-slate-700 border-slate-600 text-indigo-600" /> Website
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300 col-span-2 mt-2 pt-2 border-t border-slate-700/50">
              <input type="checkbox" checked={resumeData.summary.visible} onChange={(e) => setResumeData(prev => ({ ...prev, summary: { ...prev.summary, visible: e.target.checked } }))} className="rounded bg-slate-700 border-slate-600 text-indigo-600" /> Include Executive Summary
            </label>
          </div>
        </div>

        {/* Dynamic Lists using Toggle Helper */}
        <ToggleList title="Experience" icon={Briefcase} field="experience" dataArray={resumeData.experience} renderContent={item => (
          <><h3 className="text-xs font-bold text-white">{item.role}</h3><p className="text-[11px] text-slate-400">{item.company} • {item.period}</p></>
        )} />
        
        <ToggleList title="Projects" icon={Code} field="projects" dataArray={resumeData.projects} renderContent={item => (
          <><h3 className="text-xs font-bold text-white">{item.name}</h3><p className="text-[11px] text-slate-400">{item.role}</p></>
        )} />

        <ToggleList title="Publications" icon={BookOpen} field="publications" dataArray={resumeData.publications} renderContent={item => (
          <><h3 className="text-xs font-bold text-white line-clamp-1">{item.title}</h3><p className="text-[11px] text-slate-400">{item.venue} • {item.year}</p></>
        )} />

        <ToggleList title="Education" icon={GraduationCap} field="education" dataArray={resumeData.education} renderContent={item => (
          <><h3 className="text-xs font-bold text-white">{item.degree}</h3><p className="text-[11px] text-slate-400">{item.institution} • {item.year}</p></>
        )} />

        <ToggleList title="Awards & Honors" icon={Award} field="awards" dataArray={resumeData.awards} renderContent={item => (
          <><h3 className="text-xs font-bold text-white">{item.name}</h3><p className="text-[11px] text-slate-400">{item.issuer} • {item.year}</p></>
        )} />

        <ToggleList title="Certifications" icon={BadgeCheck} field="certifications" dataArray={resumeData.certifications} renderContent={item => (
          <><h3 className="text-xs font-bold text-white">{item.name}</h3><p className="text-[11px] text-slate-400">{item.issuer} • {item.year}</p></>
        )} />

        {resumeData.researchInterests.length > 0 && (
          <div className="space-y-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-700/40">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1"><Microscope className="w-3.5 h-3.5"/> Research Interests</h2>
            <div className="flex flex-wrap gap-2">
              {resumeData.researchInterests.map(interest => (
                <button key={interest.id} onClick={() => toggleArrayItem('researchInterests', interest.id)} className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${interest.visible ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-500 line-through opacity-60'}`}>
                  {interest.visible ? <CheckCircle2 className="w-3 h-3 text-indigo-400" /> : <EyeOff className="w-3 h-3" />} {interest.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {resumeData.skills.length > 0 && (
          <div className="space-y-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-700/40">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1"><Code className="w-3.5 h-3.5"/> Technical Skills</h2>
            <div className="flex flex-wrap gap-2">
              {resumeData.skills.map(skill => (
                <button key={skill.id} onClick={() => toggleArrayItem('skills', skill.id)} className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${skill.visible ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-500 line-through opacity-60'}`}>
                  {skill.visible ? <CheckCircle2 className="w-3 h-3 text-indigo-400" /> : <EyeOff className="w-3 h-3" />} {skill.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {resumeData.languages.length > 0 && (
          <div className="space-y-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-700/40">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1"><Globe className="w-3.5 h-3.5"/> Languages</h2>
            <div className="flex flex-wrap gap-2">
              {resumeData.languages.map(lang => (
                <button key={lang.id} onClick={() => toggleArrayItem('languages', lang.id)} className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${lang.visible ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-500 line-through opacity-60'}`}>
                  {lang.visible ? <CheckCircle2 className="w-3 h-3 text-indigo-400" /> : <EyeOff className="w-3 h-3" />} {lang.name}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* 📄 RIGHT PANEL: LIVE PDF PREVIEW */}
      <div className="flex-1 flex flex-col bg-slate-800/50 border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white">Live PDF Preview</h2>
            <p className="text-xs text-slate-400">Updates dynamically with active checkboxes</p>
          </div>

          <PDFDownloadLink
            document={<UniversalResumePDF data={resumeData} templateId={selectedTemplate} />}
            fileName={`${(resumeData.personal.fullName || 'Resume').replace(/\s+/g, '_')}_CV.pdf`}
          >
            {({ loading }) => (
              <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 transition-all">
                <Download className="w-4 h-4" />
                {loading ? 'Compiling PDF...' : 'Download PDF'}
              </button>
            )}
          </PDFDownloadLink>
        </div>

        <div className="flex-1 p-3 sm:p-6 bg-slate-950 flex items-center justify-center">
          <PDFViewer width="100%" height="100%" className="rounded-2xl border-none shadow-2xl">
            <UniversalResumePDF data={resumeData} templateId={selectedTemplate} />
          </PDFViewer>
        </div>
      </div>

    </div>
  );
}