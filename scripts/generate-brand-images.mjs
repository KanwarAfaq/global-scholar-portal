// Renders the default social-share image (1200x630 JPEG, small enough for chat apps) and the Organization logo (512x512) to public/.
// Usage: node scripts/generate-brand-images.mjs   (requires the Playwright Chromium already installed)
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const cap = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>';
const font = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif";
const og = `<html><body style="margin:0;width:1200px;height:630px;${font};background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 55%,#312e81 100%);color:#fff;position:relative;overflow:hidden">
<div style="position:absolute;right:-140px;top:-160px;width:560px;height:560px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,.35),transparent 68%)"></div>
<div style="position:absolute;left:-120px;bottom:-200px;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.45),transparent 68%)"></div>
<div style="position:relative;padding:72px 84px;height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between">
 <div style="display:flex;align-items:center;gap:20px"><div style="width:76px;height:76px;border-radius:20px;background:#4f46e5;display:grid;place-items:center;box-shadow:0 12px 30px rgba(79,70,229,.5)"><div style="width:42px;height:42px">${cap}</div></div>
 <div style="font-size:46px;font-weight:800;letter-spacing:-1px">Scholar<span style="color:#818cf8">Portal</span></div></div>
 <div><div style="font-size:74px;line-height:1.06;font-weight:900;letter-spacing:-2px">Fully funded scholarships<br><span style="background:linear-gradient(90deg,#818cf8,#22d3ee);-webkit-background-clip:text;color:transparent">for international students</span></div>
 <div style="margin-top:26px;font-size:30px;color:#cbd5e1;max-width:900px">Verified scholarships, fellowships, internships and degree programs — with official sources and deadlines.</div></div>
 <div style="font-size:26px;color:#94a3b8;font-weight:600">scholarportal.site</div></div></body></html>`;
const logo = `<html><body style="margin:0;width:512px;height:512px;${font};background:#4f46e5;display:grid;place-items:center"><div style="width:288px;height:288px">${cap}</div></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
for (const [html, w, h, file] of [[og, 1200, 630, 'public/og-default.jpg'], [logo, 512, 512, 'public/logo-512.png']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(html);
  await page.screenshot(file.endsWith('.jpg') ? { path: file, type: 'jpeg', quality: 86 } : { path: file });
  await page.close();
  console.log('wrote', file, fs.statSync(file).size, 'bytes');
}
await browser.close();
