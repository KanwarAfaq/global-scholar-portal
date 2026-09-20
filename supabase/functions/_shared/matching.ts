// Evidence-only rule evaluation. Career labels and profile names are never entry requirements.
const flatten=(v:unknown):string=>typeof v==='string'?v:Array.isArray(v)?v.map(flatten).join(' '):v&&typeof v==='object'?Object.values(v).map(flatten).join(' '):String(v??'');
const values=(v:any):string[]=>Array.isArray(v)?v.map(flatten):typeof v==='string'?v.split(',').map(x=>x.trim()).filter(Boolean):[];
export function degreeRank(v:unknown):number {const s=flatten(v).toLowerCase();if(/ph\.?d|doctor/.test(s))return 3;if(/master|m\.?sc|m\.?tech|mba/.test(s))return 2;if(/bachelor|b\.?sc|b\.?tech|undergraduate/.test(s))return 1;return 0;}
export function deterministicMatch(profile:any,opportunity:any){
 const e=opportunity?.eligibility||{},r=opportunity?.requirements||{},matched:string[]=[],warnings:string[]=[];
 let checks=0,passed=0,conflict=false,unknown=false;
 const check=(known:boolean,ok:boolean,yes:string,no:string)=>{checks++;if(!known){unknown=true;warnings.push('Needs confirmation: '+no);}else if(ok){passed++;matched.push(yes);}else{conflict=true;warnings.push(no);}};
 const citizens=values(e.citizenships||e.nationalities||e.countries);
 if(citizens.length&&!citizens.some(x=>/^(all|international|any)$/i.test(x)))check(Boolean(profile?.citizenship||profile?.nationality),citizens.some(x=>x.toLowerCase()===String(profile?.citizenship||profile?.nationality).toLowerCase()),'Citizenship matches','Citizenship does not match or is missing');
 // Only a stated minimum counts; opportunity type is the target award, not a completed qualification.
 const explicit=e.minimum_degree||e.required_degree||r.minimum_degree||r.required_degree;
 const description=String(opportunity?.description||'');
 const phrase=description.match(/(?:must have|must hold|hold|holds|required?|minimum|have)\s+(?:a\s+)?(master[’']?s|bachelor[’']?s|doctoral|phd)(?:\s+degree)?/i);
 const required=degreeRank(explicit||phrase?.[1]);
 const education=Array.isArray(profile?.education)?profile.education:[];
 const completed=Math.max(0,...education.filter((x:any)=>!/(pursuing|in progress|expected)/i.test(String(x.status||''))).map((x:any)=>degreeRank(x.degree)));
 if(required)check(completed>0,completed>=required,'Academic degree meets the stated minimum','Completed degree does not meet the stated minimum or is unknown');
 else {unknown=true;warnings.push('Entry qualification requires confirmation from the official source');}
 if(e.min_gpa||r.min_gpa){const min=Number(e.min_gpa||r.min_gpa),scale=Number(e.gpa_scale||r.gpa_scale);const known=Number(profile?.gpa)>0&&scale>0&&scale===Number(profile?.gpa_scale);check(known,Number(profile?.gpa)>=min,'GPA meets the stated minimum','GPA is missing, below minimum, or uses an unconfirmed scale');}
 const rules=Array.isArray(e.language_tests)?e.language_tests:[];
 if(rules.length){const t=profile?.english_test||{};const rule=rules.find((x:any)=>String(x.type).toLowerCase()===String(t.type).toLowerCase());check(Boolean(rule&&t.score!==''&&t.score!=null),Number(t.score)>=Number(rule?.min_score),'Language score meets the minimum','Comparable language score is missing or below minimum');}
 const field=String(opportunity?.field||'').toLowerCase();const relevance=field&&flatten(profile).toLowerCase().includes(field)?75:50;
 if(relevance===75)matched.push('Academic or research field overlaps');
 const eligible=conflict?false:unknown?null:checks?true:null;const eligibility_score=checks?Math.round(passed/checks*100):50;
 return {eligible,score:Math.min(conflict?49:100,Math.round(.65*eligibility_score+.35*relevance)),eligibility_score,relevance_score:relevance,competitiveness_score:null,matched_rules:matched,warnings,assessment_version:'evidence-v2'};
}
