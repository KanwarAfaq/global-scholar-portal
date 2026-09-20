export const COUNTRY_CODES={Australia:'AU',Austria:'AT',Bangladesh:'BD',Belgium:'BE',Brazil:'BR',Brunei:'BN','Brunei Darussalam':'BN',Canada:'CA',China:'CN',Denmark:'DK',Egypt:'EG',Finland:'FI',France:'FR',Germany:'DE',India:'IN',Indonesia:'ID',Ireland:'IE',Italy:'IT',Japan:'JP',Malaysia:'MY',Netherlands:'NL','New Zealand':'NZ',Norway:'NO',Pakistan:'PK',Poland:'PL',Qatar:'QA','Saudi Arabia':'SA',Singapore:'SG','South Africa':'ZA','South Korea':'KR',Spain:'ES',Sweden:'SE',Switzerland:'CH',Taiwan:'TW',Thailand:'TH',Turkey:'TR',UAE:'AE','United Arab Emirates':'AE',UK:'GB','United Kingdom':'GB',USA:'US','United States':'US',Vietnam:'VN'};
export const COUNTRIES=Object.keys(COUNTRY_CODES);
export const LEVELS=['Bachelor','Master','PhD','Postdoctoral','Fellowship','Scholarship','Internship'];
export const FIELDS=['Computer Science','Engineering','Medicine','Natural Sciences','Social Sciences','Business','Arts and Humanities','Education','Law','Mathematics'];
export function flag(country){const code=COUNTRY_CODES[country];return code?String.fromCodePoint(...[...code].map(c=>127397+c.charCodeAt(0))):'🌐';}
export function safeUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}}
export function officialUrl(o){return safeUrl(o?.official_source_url)||safeUrl(o?.source_url)||safeUrl(o?.url);}
export function daysLeft(deadline){if(!/^\d{4}-\d{2}-\d{2}$/.test(deadline||''))return null;return Math.ceil((new Date(deadline+'T23:59:59Z')-Date.now())/86400000);}
