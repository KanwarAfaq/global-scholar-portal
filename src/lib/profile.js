export function list(value) {
  if (Array.isArray(value)) return value.filter(x=>x!=null);
  if (typeof value === 'string') { try { const v=JSON.parse(value); if(Array.isArray(v))return v; } catch {} return value.split(',').map(x=>x.trim()).filter(Boolean); }
  return [];
}
export function skillGroups(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return Object.entries(value).map(([category,skills])=>({category,skills:list(skills).join(', ')}));
  return list(value).map(x=>typeof x==='string'?{category:'Skills',skills:x}:{...x,skills:Array.isArray(x.skills)?x.skills.join(', '):String(x.skills||'')});
}
export function normalizeProfile(p) {
  const result={...p,technical_skills:skillGroups(p.technical_skills),research_interests:list(p.research_interests).map(x=>typeof x==='string'?{name:x}:x)};
  for(const key of ['education','experience','publications','projects','awards','certifications','languages']) result[key]=list(p[key]).map(x=>typeof x==='string'?{name:x}:x);
  result.education=result.education.map(x=>({...x,institution:x.institution||x.school||x.university||'',period:x.period||x.year||''}));
  result.experience=result.experience.map(x=>({...x,organization:x.organization||x.company||x.employer||''}));
  result.publications=result.publications.map(x=>({...x,venue:x.venue||x.journal||x.conference||''}));
  return result;
}
export function activeProfileId(userId) { try{return localStorage.getItem(`active-profile:${userId}`)||'';}catch{return '';} }
export function selectProfile(userId,id) { try{localStorage.setItem(`active-profile:${userId}`,id);window.dispatchEvent(new Event('active-profile-changed'));}catch{} }
