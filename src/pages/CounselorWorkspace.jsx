import { notify } from '../lib/notify';
import React,{useEffect,useState}from'react';
import{Users,Plus,CheckCircle2,Clock,AlertTriangle,LockKeyhole}from'lucide-react';
import{Link}from'react-router-dom';
import {useAuth} from '../context/session';
import {supabase} from '../context/../lib/supabase';
import{runAiAction}from'../lib/ai';

export default function CounselorWorkspace(){
  const{user}=useAuth();
  const[org,setOrg]=useState(null);const[students,setStudents]=useState([]);const[tasks,setTasks]=useState([]);const[review,setReview]=useState(null);const[plan,setPlan]=useState('free');

  const load=async()=>{
    const{data:sub}=await supabase.from('subscriptions').select('plan_id,status').eq('user_id',user.id).maybeSingle();
    setPlan(['active','trialing'].includes(sub?.status)?sub.plan_id:'free');
    let{data:o}=await supabase.from('organizations').select('*').eq('owner_user_id',user.id).in('type',['counselor','agency']).limit(1).maybeSingle();
    if(!o){
      const{data:m}=await supabase.from('organization_members').select('role,organizations(*)').eq('user_id',user.id).limit(1).maybeSingle();
      o=m?.organizations||null;
    }
    setOrg(o||null);
    if(o){
      const[{data:s},{data:t}]=await Promise.all([
        supabase.from('counselor_students').select('*').eq('organization_id',o.id).order('created_at',{ascending:false}),
        supabase.from('tasks').select('*').eq('organization_id',o.id).order('due_at')
      ]);setStudents(s||[]);setTasks(t||[]);
    }else{setStudents([]);setTasks([])}
  };
  useEffect(()=>{if(user)load()},[user]); // eslint-disable-line react-hooks/exhaustive-deps

  const createOrg=async()=>{if(plan!=='counselor')return notify('The Counselor plan is required to create a counselor/agency workspace.');const name=prompt('Counselor/agency workspace name');if(!name)return;const{data,error}=await supabase.from('organizations').insert({owner_user_id:user.id,name,type:'counselor'}).select().single();if(error)notify(error.message);else{await supabase.from('organization_members').insert({organization_id:data.id,user_id:user.id,role:'owner'});load()}};
  const invite=async()=>{const email=prompt('Student email')?.trim().toLowerCase();if(!email)return;const name=prompt('Student display name (optional)')||email;const{error}=await supabase.from('counselor_students').insert({organization_id:org.id,student_email:email,display_name:name,invited_by:user.id});if(error)notify(error.message);else load()};
  const addTask=async student=>{const title=prompt('Task title');if(!title)return;const{error}=await supabase.from('tasks').insert({user_id:user.id,organization_id:org.id,student_user_id:student.student_user_id||null,title,priority:'normal'});if(error)notify(error.message);else load()};
  const aiReview=async student=>{if(!student.student_user_id||!student.consented_at){notify('The student must accept/connect their ScholarPortal account before AI readiness review can use private data.');return}try{const r=await runAiAction('counselor_review',{extra:{student_user_id:student.student_user_id,display_name:student.display_name}});setReview(r.structured||r.text)}catch(e){notify(e.message)}};

  return <div className="space-y-6"><div><h1 className="text-3xl font-black text-slate-900 dark:text-white">Counselor Workspace</h1><p className="text-slate-500">Manage students, deadlines and application work with explicit student participation.</p></div>
    {!org?<div className="space-y-4">{plan!=='counselor'&&<div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10"><div className="flex gap-2 font-extrabold text-amber-700 dark:text-amber-300"><LockKeyhole className="w-5 h-5"/>Counselor plan required</div><p className="text-sm text-slate-600 dark:text-slate-300 mt-2">Choose a Counselor plan to create a workspace and invite students.</p><Link to="/pricing" className="inline-block mt-3 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold">View plans</Link></div>}<button disabled={plan!=='counselor'} onClick={createOrg} className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold flex gap-2"><Users className="w-5 h-5"/>Create counselor workspace</button></div>:<>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"><div><p className="text-xs font-bold text-slate-500">WORKSPACE</p><h2 className="text-xl font-extrabold text-slate-900 dark:text-white">{org.name}</h2></div><button onClick={invite} className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold flex gap-2 justify-center"><Plus className="w-4 h-4"/>Invite student</button></div>
      <div className="grid lg:grid-cols-2 gap-4">{students.map(s=>{const st=tasks.filter(t=>t.student_user_id&&t.student_user_id===s.student_user_id);return <div key={s.id} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"><div className="flex justify-between gap-3"><div className="min-w-0"><h3 className="font-extrabold text-slate-900 dark:text-white break-words">{s.display_name||s.student_email}</h3><p className="text-sm text-slate-500 break-all">{s.student_email} · {s.status}</p></div>{s.consented_at?<CheckCircle2 className="text-emerald-500 shrink-0"/>:<Clock className="text-amber-500 shrink-0"/>}</div><p className="text-sm text-slate-500 mt-3">{st.filter(t=>t.status!=='done').length} open tasks</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>addTask(s)} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-bold">Add task</button><button onClick={()=>aiReview(s)} className="px-3 py-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 rounded-xl text-sm font-bold">AI readiness review</button></div></div>})}</div>
      {review&&<pre className="p-5 whitespace-pre-wrap rounded-2xl bg-slate-950 text-slate-200 text-sm overflow-auto">{typeof review==='string'?review:JSON.stringify(review,null,2)}</pre>}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"><h2 className="font-extrabold text-slate-900 dark:text-white mb-3">Team task queue</h2>{tasks.length===0?<p className="text-sm text-slate-500">No tasks yet.</p>:tasks.map(t=><div key={t.id} className="flex items-center gap-3 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800">{t.priority==='urgent'?<AlertTriangle className="w-4 h-4 text-rose-500 shrink-0"/>:<Clock className="w-4 h-4 text-slate-400 shrink-0"/>}<span className="flex-1 text-sm text-slate-700 dark:text-slate-200 break-words">{t.title}</span><span className="text-xs text-slate-500">{t.status}</span></div>)}</div>
    </>}
  </div>;
}
