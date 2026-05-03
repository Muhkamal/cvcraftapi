import { useState, useRef, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   CVCraft — Complete Production SPA
   Views: landing → auth → dashboard → builder → payment callback
   ═══════════════════════════════════════════════════════════════ */

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=Lora:wght@400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');`;

// ─── API CLIENT ───────────────────────────────────────────────────────────────
const API_URL = typeof import !== "undefined"
  ? (window.__API_URL__ || "http://localhost:8000")
  : "http://localhost:8000";

let _token = localStorage.getItem("cvcraft_token");
const setToken = t => { _token = t; t ? localStorage.setItem("cvcraft_token", t) : localStorage.removeItem("cvcraft_token"); };

async function req(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (_token) headers["Authorization"] = `Bearer ${_token}`;
  const resp = await fetch(`${API_URL}${path}`, { ...opts, headers });
  if (resp.status === 204) return null;
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.detail || `Error ${resp.status}`);
  return data;
}

async function downloadFile(path, body, filename) {
  const headers = { "Content-Type": "application/json" };
  if (_token) headers["Authorization"] = `Bearer ${_token}`;
  const resp = await fetch(`${API_URL}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.detail || "Download failed"); }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const api = {
  auth: {
    register: (email, password, fullName) => req("/auth/register", { method: "POST", body: JSON.stringify({ email, password, full_name: fullName }) }),
    login: async (email, password) => {
      const d = await req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setToken(d.session.access_token);
      return d;
    },
    me: () => req("/auth/me"),
    logout: () => { setToken(null); },
  },
  resumes: {
    list: () => req("/resumes"),
    create: data => req("/resumes", { method: "POST", body: JSON.stringify(data) }),
    get: id => req(`/resumes/${id}`),
    update: (id, data) => req(`/resumes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: id => req(`/resumes/${id}`, { method: "DELETE" }),
  },
  export: {
    pdf: (resumeIdOrData, name) => downloadFile("/export/pdf",
      typeof resumeIdOrData === "string" ? { resume_id: resumeIdOrData } : { resume_data: resumeIdOrData },
      `${name || "resume"}.pdf`),
    docx: (resumeIdOrData, name) => downloadFile("/export/docx",
      typeof resumeIdOrData === "string" ? { resume_id: resumeIdOrData } : { resume_data: resumeIdOrData },
      `${name || "resume"}.docx`),
  },
  ai: {
    bullets: (jobTitle, company, jobDescription, count = 5) =>
      req("/ai/bullets", { method: "POST", body: JSON.stringify({ job_title: jobTitle, company, job_description: jobDescription, count }) }),
    summary: (jobTitle, experience, skills) =>
      req("/ai/summary", { method: "POST", body: JSON.stringify({ job_title: jobTitle, experience, skills }) }),
    skills: (jobTitle, count = 12) =>
      req("/ai/skills", { method: "POST", body: JSON.stringify({ job_title: jobTitle, count }) }),
    match: (resumeData, jobDescription) =>
      req("/ai/match", { method: "POST", body: JSON.stringify({ resume_data: resumeData, job_description: jobDescription }) }),
    import: text =>
      req("/ai/bullets", { method: "POST", body: JSON.stringify({ job_title: "import", company: "", job_description: text, count: 3 }) }),
  },
  payments: {
    initialize: (plan, email) => req("/payments/initialize", { method: "POST", body: JSON.stringify({ plan, email }) }),
    verify: (reference, plan) => req("/payments/verify", { method: "POST", body: JSON.stringify({ reference, plan }) }),
  },
  user: {
    stats: () => req("/user/stats"),
    subscription: () => req("/user/subscription"),
  },
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);

const TEMPLATES = [
  { id:"executive", label:"Executive", best:"Finance · Law · C-Suite",     hBg:"#1a1a2e", hC:"#fff" },
  { id:"minimal",   label:"Minimal",   best:"Design · Startups",           hBg:"#fff",    hC:"#111" },
  { id:"corporate", label:"Corporate", best:"Banking · Consulting",         hBg:"#fff",    hC:"#1c2b4a" },
  { id:"modern",    label:"Modern",    best:"Marketing · Product",          hBg:"#0f0f1a", hC:"#fff" },
  { id:"classic",   label:"Classic",   best:"All industries",               hBg:"#fff",    hC:"#111" },
  { id:"tech",      label:"Tech",      best:"Engineering · Dev",            hBg:"#0d1117", hC:"#e6edf3" },
  { id:"elegant",   label:"Elegant",   best:"Academia · Non-profit",        hBg:"#fff",    hC:"#1a1208" },
  { id:"bold",      label:"Bold",      best:"Sales · Creative",             hBg:"#1a1a2e", hC:"#fff" },
];

const PLANS = [
  { id:"free",     name:"Free",     price:"₦0",      period:"",       amount:0,
    features:[{t:"1 resume",y:1},{t:"5 ATS templates",y:1},{t:"Basic AI",y:1},{t:"1 PDF/day",y:1},{t:"All 8 templates",y:0},{t:"Unlimited exports",y:0},{t:"Job Match Score",y:0}] },
  { id:"pro",      name:"Pro",      price:"₦4,500",  period:"/mo",    amount:450000, featured:true,
    features:[{t:"Unlimited resumes",y:1},{t:"All 8 templates",y:1},{t:"Advanced AI",y:1},{t:"Unlimited exports",y:1},{t:"Job Match Score",y:1},{t:"PDF + DOCX",y:1},{t:"Priority support",y:1}] },
  { id:"lifetime", name:"Lifetime", price:"₦19,900", period:" once",  amount:1990000,
    features:[{t:"Everything in Pro",y:1},{t:"Lifetime access",y:1},{t:"Future templates",y:1},{t:"Resume import",y:1},{t:"Cover letter (soon)",y:1},{t:"1-on-1 review",y:1},{t:"Early access",y:1}] },
];

const INIT_RESUME = {
  title:"Untitled Resume", template:"executive",
  personal_info:{ fullName:"", jobTitle:"", email:"", phone:"", location:"", linkedin:"", website:"", summary:"" },
  experience:[], education:[], skills:[], certifications:[], job_description:"",
};

const STEPS = ["Personal","Experience","Education","Skills","Certs","Template","AI Match"];

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
${FONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --ink:#0a0a0f;--ink-2:#1c1c28;--ink-3:#2e2e42;
  --muted:#6b6b85;--muted-2:#9999b3;
  --border:#e2e2ee;--surface:#f7f7fc;--white:#fff;
  --accent:#4f46e5;--accent-2:#7c3aed;--accent-light:#eef2ff;
  --success:#059669;--warning:#d97706;--danger:#dc2626;
  --radius:12px;--radius-sm:8px;
  --shadow:0 1px 3px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.06);
  --shadow-lg:0 8px 32px rgba(0,0,0,.12),0 2px 8px rgba(0,0,0,.06);
  --t:.2s cubic-bezier(.4,0,.2,1);
}
html,body{font-family:'DM Sans',sans-serif;background:var(--surface);color:var(--ink);min-height:100vh;font-size:15px;-webkit-font-smoothing:antialiased}

/* ── NAV ── */
.nav{background:rgba(255,255,255,.92);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100;backdrop-filter:blur(12px)}
.nav-inner{max-width:1200px;margin:0 auto;padding:0 24px;height:64px;display:flex;align-items:center;justify-content:space-between}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:22px;color:var(--ink);letter-spacing:-.5px;cursor:pointer}
.logo span{color:var(--accent)}
.nav-right{display:flex;gap:12px;align-items:center}
.nav-link{background:none;border:none;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;color:var(--muted);cursor:pointer;padding:7px 12px;border-radius:var(--radius-sm);transition:var(--t)}
.nav-link:hover,.nav-link.active{color:var(--accent);background:var(--accent-light)}
.plan-chip{font-size:12px;font-weight:700;color:var(--success);background:#dcfce7;padding:4px 12px;border-radius:20px}

/* ── BUTTONS ── */
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;border:none;transition:var(--t);white-space:nowrap;text-decoration:none}
.btn-primary{background:var(--accent);color:#fff;box-shadow:0 2px 8px rgba(79,70,229,.3)}
.btn-primary:hover{background:#4338ca;transform:translateY(-1px);box-shadow:0 4px 16px rgba(79,70,229,.4)}
.btn-secondary{background:var(--white);color:var(--ink);border:1.5px solid var(--border)}
.btn-secondary:hover{border-color:var(--accent);color:var(--accent)}
.btn-ghost{background:transparent;color:var(--muted);border:none}
.btn-ghost:hover{color:var(--ink);background:var(--surface)}
.btn-danger{background:#fef2f2;color:var(--danger);border:1.5px solid #fecaca}
.btn-danger:hover{background:var(--danger);color:#fff}
.btn-outline{background:transparent;color:var(--accent);border:2px solid var(--accent)}
.btn-outline:hover{background:var(--accent);color:#fff}
.btn-sm{padding:7px 14px;font-size:13px}
.btn-lg{padding:14px 32px;font-size:16px;border-radius:10px}
.btn-xl{padding:16px 40px;font-size:17px;border-radius:12px}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}
.btn-full{width:100%;justify-content:center}

/* ── FORMS ── */
.field{margin-bottom:16px}
.field label{display:block;font-size:13px;font-weight:600;color:var(--ink-3);margin-bottom:6px}
.field input,.field textarea,.field select{width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:14px;color:var(--ink);background:var(--white);transition:var(--t);outline:none}
.field input:focus,.field textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(79,70,229,.1)}
.field textarea{resize:vertical;min-height:88px;line-height:1.5}
.field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.field-hint{font-size:12px;color:var(--muted);margin-top:4px}

/* ── CARDS ── */
.card{background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius);padding:20px}
.card-sm{padding:16px}
.card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.card-title{font-size:15px;font-weight:700;color:var(--ink)}

/* ── AI PANEL ── */
.ai-panel{background:linear-gradient(135deg,#eef2ff,#f5f3ff);border:1.5px solid #c7d2fe;border-radius:var(--radius);padding:16px;margin-bottom:16px}
.ai-badge{background:var(--accent);color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px}
.ai-panel-header{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.ai-panel h3{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--accent)}
.ai-suggestion{background:#fff;border:1.5px solid #c7d2fe;border-radius:var(--radius-sm);padding:11px;margin-bottom:8px;font-size:13px;line-height:1.6;color:var(--ink-3);cursor:pointer;transition:var(--t)}
.ai-suggestion:hover{border-color:var(--accent);background:var(--accent-light)}
.spinner{width:18px;height:18px;border:2px solid #c7d2fe;border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
.spinner-lg{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.ai-loading{display:flex;align-items:center;gap:10px;color:var(--accent);font-size:14px;padding:12px 0}

/* ── LAYOUT ── */
.app-shell{display:grid;grid-template-columns:390px 1fr;min-height:calc(100vh - 64px)}
.sidebar{background:var(--white);border-right:1px solid var(--border);overflow-y:auto;max-height:calc(100vh - 64px);position:sticky;top:64px}
.preview-pane{background:#d0d0e0;padding:28px;overflow-y:auto;display:flex;flex-direction:column;align-items:center;gap:20px}
.sidebar-header{padding:20px 24px 16px;border-bottom:1px solid var(--border)}
.sidebar-header h2{font-family:'Syne',sans-serif;font-weight:700;font-size:16px;color:var(--ink)}
.sidebar-header p{font-size:13px;color:var(--muted);margin-top:3px}
.step-tabs{display:flex;padding:10px 24px;gap:4px;border-bottom:1px solid var(--border);overflow-x:auto;scrollbar-width:none}
.step-tabs::-webkit-scrollbar{display:none}
.step-tab{flex-shrink:0;padding:6px 11px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:none;color:var(--muted);transition:var(--t)}
.step-tab.active{background:var(--accent);color:#fff}
.step-tab.done{background:#dcfce7;color:var(--success)}
.sidebar-body{padding:20px 24px}
.progress-bar{height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin:12px 24px 0}
.progress-fill{height:100%;background:linear-gradient(to right,var(--accent),var(--accent-2));border-radius:2px;transition:width .5s ease}

/* ── TAG INPUT ── */
.tag-input-container{display:flex;flex-wrap:wrap;gap:6px;padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--radius-sm);min-height:44px;cursor:text;transition:var(--t)}
.tag-input-container:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px rgba(79,70,229,.1)}
.tag{background:var(--accent-light);color:var(--accent);font-size:13px;font-weight:600;padding:3px 10px;border-radius:20px;display:flex;align-items:center;gap:6px}
.tag-remove{cursor:pointer;opacity:.6;font-size:16px;line-height:1}
.tag-remove:hover{opacity:1}
.tag-input{border:none;outline:none;font-family:'DM Sans',sans-serif;font-size:14px;color:var(--ink);background:transparent;flex:1;min-width:80px}

/* ── TEMPLATE PICKER ── */
.tpl-picker{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.tpl-card{border:2px solid var(--border);border-radius:var(--radius-sm);padding:7px 5px 9px;cursor:pointer;transition:var(--t);text-align:center}
.tpl-card.active{border-color:var(--accent);background:var(--accent-light)}
.tpl-card:hover{border-color:var(--accent)}
.tpl-thumb{height:56px;border-radius:3px;margin-bottom:6px;overflow:hidden;display:flex;flex-direction:column}
.tpl-label{font-size:11px;font-weight:700;color:var(--ink)}
.ats-badge{font-size:9px;font-weight:700;color:var(--success);background:#dcfce7;padding:1px 5px;border-radius:8px;margin-top:2px;display:inline-block}

/* ── ALERTS ── */
.alert{padding:12px 16px;border-radius:var(--radius-sm);font-size:13px;margin-bottom:14px;line-height:1.5;display:flex;align-items:flex-start;gap:8px}
.alert-info{background:var(--accent-light);color:var(--accent);border:1px solid #c7d2fe}
.alert-warning{background:#fffbeb;color:var(--warning);border:1px solid #fde68a}
.alert-success{background:#ecfdf5;color:var(--success);border:1px solid #86efac}
.alert-danger{background:#fef2f2;color:var(--danger);border:1px solid #fecaca}

/* ── TOAST ── */
.toast{position:fixed;bottom:24px;right:24px;padding:14px 20px;border-radius:var(--radius-sm);font-size:14px;font-weight:500;z-index:500;box-shadow:var(--shadow-lg);animation:slideUp .3s ease;max-width:340px;display:flex;align-items:center;gap:10px}
.toast-default{background:var(--ink);color:#fff}
.toast-success{background:var(--success);color:#fff}
.toast-error{background:var(--danger);color:#fff}
.toast-warning{background:var(--warning);color:#fff}
@keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}

/* ── MODAL ── */
.modal-overlay{position:fixed;inset:0;background:rgba(10,10,15,.6);backdrop-filter:blur(4px);z-index:300;display:flex;align-items:center;justify-content:center;padding:24px}
.modal{background:var(--white);border-radius:20px;padding:36px;max-width:480px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.2)}
.modal-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--ink);margin-bottom:8px}
.modal-desc{font-size:14px;color:var(--muted);margin-bottom:24px;line-height:1.6}
.modal-actions{display:flex;gap:12px;margin-top:20px}

/* ── EMPTY STATE ── */
.empty-state{text-align:center;padding:36px 16px;color:var(--muted)}
.empty-icon{font-size:36px;margin-bottom:10px}
.empty-state h3{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:var(--ink-3);margin-bottom:6px}
.empty-state p{font-size:14px;line-height:1.6}

/* ── PRICING ── */
.pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:940px;margin:0 auto}
.pricing-card{background:var(--white);border:2px solid var(--border);border-radius:16px;padding:28px 22px;position:relative;transition:var(--t)}
.pricing-card.featured{border-color:var(--accent);box-shadow:0 0 0 4px rgba(79,70,229,.08)}
.pricing-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg)}
.pricing-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--accent);color:#fff;font-size:11px;font-weight:700;padding:4px 14px;border-radius:20px;white-space:nowrap}
.pricing-name{font-family:'Syne',sans-serif;font-size:17px;font-weight:700}
.pricing-price{font-family:'Syne',sans-serif;font-size:34px;font-weight:800;color:var(--ink);margin:10px 0 4px}
.pricing-price span{font-size:15px;font-weight:500;color:var(--muted)}
.pricing-desc{font-size:13px;color:var(--muted);margin-bottom:18px}
.pricing-features{list-style:none;margin-bottom:22px}
.pricing-features li{font-size:13px;padding:6px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px}
.pricing-features li:last-child{border-bottom:none}

/* ── MATCH SCORE ── */
.match-box{background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border:2px solid #86efac;border-radius:var(--radius);padding:20px;margin-top:16px;text-align:center}
.match-number{font-family:'Syne',sans-serif;font-size:52px;font-weight:800;color:var(--success);line-height:1}
.match-bar{height:8px;background:#dcfce7;border-radius:4px;margin:12px 0 4px;overflow:hidden}
.match-fill{height:100%;background:linear-gradient(to right,var(--success),#10b981);border-radius:4px;transition:width 1.2s ease}
.match-tip{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-top:1px solid #dcfce7;font-size:13px;color:var(--ink-3);line-height:1.5;text-align:left}

/* ══════════════════════════════════════════════════════════
   LANDING PAGE
══════════════════════════════════════════════════════════ */
.hero{max-width:1200px;margin:0 auto;padding:80px 24px 60px;text-align:center}
.hero-eyebrow{display:inline-flex;align-items:center;gap:8px;background:var(--accent-light);border:1px solid #c7d2fe;color:var(--accent);font-size:13px;font-weight:700;padding:6px 16px;border-radius:20px;margin-bottom:28px;letter-spacing:.3px}
.hero-title{font-family:'Syne',sans-serif;font-size:clamp(36px,6vw,68px);font-weight:800;color:var(--ink);line-height:1.05;letter-spacing:-2px;margin-bottom:24px}
.hero-title span{color:var(--accent)}
.hero-sub{font-size:clamp(16px,2vw,20px);color:var(--muted);line-height:1.65;max-width:580px;margin:0 auto 40px}
.hero-actions{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:56px}
.hero-trust{display:flex;align-items:center;justify-content:center;gap:28px;flex-wrap:wrap;color:var(--muted);font-size:13px}
.trust-item{display:flex;align-items:center;gap:6px;font-weight:500}

.features-section{background:var(--white);padding:80px 24px;border-top:1px solid var(--border)}
.section-label{font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--accent);margin-bottom:12px}
.section-title{font-family:'Syne',sans-serif;font-size:clamp(28px,4vw,42px);font-weight:800;color:var(--ink);letter-spacing:-1px;margin-bottom:16px}
.section-sub{font-size:16px;color:var(--muted);line-height:1.65;max-width:560px;margin:0 auto}
.features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;max-width:1100px;margin:56px auto 0}
.feature-card{padding:28px;border-radius:16px;border:1.5px solid var(--border);background:var(--white);transition:var(--t)}
.feature-card:hover{border-color:var(--accent);box-shadow:var(--shadow-lg);transform:translateY(-4px)}
.feature-icon{font-size:32px;margin-bottom:16px}
.feature-title{font-family:'Syne',sans-serif;font-size:17px;font-weight:700;color:var(--ink);margin-bottom:8px}
.feature-desc{font-size:14px;color:var(--muted);line-height:1.65}

.templates-section{padding:80px 24px;text-align:center}
.templates-scroll{display:flex;gap:16px;overflow-x:auto;padding:24px 0;scrollbar-width:none;max-width:1100px;margin:0 auto}
.templates-scroll::-webkit-scrollbar{display:none}
.tpl-showcase{flex-shrink:0;width:200px;background:var(--white);border:2px solid var(--border);border-radius:12px;overflow:hidden;cursor:pointer;transition:var(--t)}
.tpl-showcase:hover{border-color:var(--accent);transform:translateY(-4px);box-shadow:var(--shadow-lg)}
.tpl-showcase-head{height:60px;display:flex;flex-direction:column;justify-content:flex-end;padding:10px 12px}
.tpl-showcase-body{padding:12px;display:flex;flex-direction:column;gap:4px}
.tpl-showcase-line{height:2px;background:var(--border);border-radius:1px}
.tpl-showcase-label{padding:10px 12px;border-top:1px solid var(--border)}
.tpl-showcase-name{font-family:'Syne',sans-serif;font-size:12px;font-weight:700;color:var(--ink)}
.tpl-showcase-best{font-size:11px;color:var(--muted);margin-top:1px}

.social-proof{background:linear-gradient(135deg,#0f0f1a,#1c1c38);padding:80px 24px;text-align:center;color:#fff}
.testimonials-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:1000px;margin:48px auto 0}
.testimonial{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:24px;text-align:left}
.testimonial-text{font-size:14px;color:#c7d2fe;line-height:1.7;margin-bottom:16px;font-style:italic}
.testimonial-author{font-size:13px;font-weight:600;color:#fff}
.testimonial-role{font-size:12px;color:#8b949e;margin-top:2px}
.testimonial-stars{color:#f59e0b;font-size:14px;margin-bottom:12px}

.cta-section{padding:80px 24px;text-align:center;background:var(--white)}

/* ══════════════════════════════════════════════════════════
   AUTH PAGE
══════════════════════════════════════════════════════════ */
.auth-wrap{min-height:calc(100vh - 64px);display:flex;align-items:center;justify-content:center;padding:40px 24px;background:var(--surface)}
.auth-box{background:var(--white);border:1.5px solid var(--border);border-radius:20px;padding:40px;max-width:420px;width:100%;box-shadow:var(--shadow-lg)}
.auth-title{font-family:'Syne',sans-serif;font-size:26px;font-weight:800;color:var(--ink);margin-bottom:6px}
.auth-sub{font-size:14px;color:var(--muted);margin-bottom:28px;line-height:1.5}
.auth-divider{display:flex;align-items:center;gap:12px;margin:20px 0;color:var(--muted);font-size:13px}
.auth-divider::before,.auth-divider::after{content:'';flex:1;height:1px;background:var(--border)}
.auth-switch{font-size:14px;color:var(--muted);text-align:center;margin-top:20px}
.auth-switch span{color:var(--accent);cursor:pointer;font-weight:600}
.auth-switch span:hover{text-decoration:underline}

/* ══════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════ */
.dashboard{max-width:1100px;margin:0 auto;padding:36px 24px}
.dashboard-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:32px;gap:16px}
.dashboard-title{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:var(--ink);letter-spacing:-.5px}
.dashboard-sub{font-size:14px;color:var(--muted);margin-top:4px}
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:36px}
.stat-card{background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius);padding:20px}
.stat-label{font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.stat-value{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:var(--ink)}
.stat-sub{font-size:12px;color:var(--muted);margin-top:4px}
.resumes-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.resume-card{background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius);overflow:hidden;transition:var(--t);cursor:pointer}
.resume-card:hover{border-color:var(--accent);box-shadow:var(--shadow-lg);transform:translateY(-2px)}
.resume-card-preview{height:140px;display:flex;flex-direction:column;overflow:hidden}
.resume-card-body{padding:14px 16px}
.resume-card-title{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--ink)}
.resume-card-meta{font-size:12px;color:var(--muted);margin-top:3px}
.resume-card-actions{display:flex;gap:8px;margin-top:12px}
.new-resume-card{background:var(--surface);border:2px dashed var(--border);border-radius:var(--radius);padding:32px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;cursor:pointer;transition:var(--t);min-height:220px}
.new-resume-card:hover{border-color:var(--accent);background:var(--accent-light)}
.new-resume-icon{font-size:36px}
.new-resume-label{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--ink-3)}

.plan-banner{background:linear-gradient(135deg,var(--accent),var(--accent-2));border-radius:var(--radius);padding:24px 28px;color:#fff;display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;gap:16px}
.plan-banner-text h3{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;margin-bottom:4px}
.plan-banner-text p{font-size:14px;opacity:.85}

/* ══════════════════════════════════════════════════════════
   PAYMENT CALLBACK
══════════════════════════════════════════════════════════ */
.callback-wrap{min-height:calc(100vh - 64px);display:flex;align-items:center;justify-content:center;padding:40px}
.callback-box{text-align:center;max-width:440px}
.callback-icon{font-size:72px;margin-bottom:24px;display:block}
.callback-title{font-family:'Syne',sans-serif;font-size:30px;font-weight:800;color:var(--ink);margin-bottom:12px;letter-spacing:-.5px}
.callback-desc{font-size:16px;color:var(--muted);line-height:1.65;margin-bottom:32px}

/* ══════════════════════════════════════════════════════════
   IMPORT MODAL
══════════════════════════════════════════════════════════ */
.import-tabs{display:flex;gap:4px;background:var(--surface);border-radius:var(--radius-sm);padding:4px;margin-bottom:20px}
.import-tab{flex:1;padding:8px;border:none;background:none;border-radius:6px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;color:var(--muted);transition:var(--t)}
.import-tab.active{background:var(--white);color:var(--ink);box-shadow:0 1px 4px rgba(0,0,0,.08)}

/* ══════════════════════════════════════════════════════════
   RESUME TEMPLATES
══════════════════════════════════════════════════════════ */
.resume-sheet{width:794px;min-height:1123px;background:#fff;box-shadow:0 4px 32px rgba(0,0,0,.18)}
/* Executive */
.tpl-executive .rh{padding:40px 52px 24px;border-bottom:2px solid #1a1a2e}
.tpl-executive .rn{font-family:'Lora',Georgia,serif;font-size:32px;font-weight:700;color:#1a1a2e}
.tpl-executive .rt{font-size:12px;color:#5c5c7a;margin-top:6px;letter-spacing:1.5px;text-transform:uppercase}
.tpl-executive .rc{display:flex;gap:0;margin-top:12px;flex-wrap:wrap}
.tpl-executive .rci{font-size:12px;color:#5c5c7a;padding-right:12px;margin-right:12px;border-right:1px solid #ccc}
.tpl-executive .rci:last-child{border-right:none}
.tpl-executive .rb{padding:28px 52px 44px}
.tpl-executive .rst{font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#4f46e5;margin-bottom:12px;padding-bottom:5px;border-bottom:1.5px solid #e4e4f4;margin-top:22px}
.tpl-executive .rst:first-child{margin-top:0}
.tpl-executive .re{margin-bottom:15px}
.tpl-executive .ret{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.tpl-executive .retitle{font-family:'Lora',serif;font-size:14px;font-weight:700;color:#1a1a2e}
.tpl-executive .redate{font-size:11px;color:#888;white-space:nowrap}
.tpl-executive .resub{font-size:12px;color:#4f46e5;font-weight:600;margin-top:2px;font-style:italic}
.tpl-executive .redesc{font-size:12px;color:#3a3a52;line-height:1.7;margin-top:7px}
.tpl-executive .rebl{list-style:none;margin-top:7px}
.tpl-executive .rebl li{font-size:12px;color:#3a3a52;line-height:1.6;padding:2px 0 2px 14px;position:relative}
.tpl-executive .rebl li::before{content:'▸';position:absolute;left:0;color:#4f46e5;font-size:9px;top:4px}
.tpl-executive .rsk{display:flex;flex-wrap:wrap;gap:6px}
.tpl-executive .rskp{font-size:11px;color:#1a1a2e;background:#f0f0f8;padding:4px 11px;border-radius:3px;border:1px solid #d8d8ec}
.tpl-executive .rsum{font-size:13px;color:#3a3a52;line-height:1.75}
/* Minimal */
.tpl-minimal .rh{padding:44px 50px 18px}
.tpl-minimal .rn{font-family:'IBM Plex Sans',sans-serif;font-size:28px;font-weight:700;color:#111;letter-spacing:-1px}
.tpl-minimal .rt{font-size:12px;color:#aaa;margin-top:4px;letter-spacing:1.5px;text-transform:uppercase;font-weight:300}
.tpl-minimal .rc{display:flex;gap:18px;margin-top:12px;padding-top:12px;border-top:1px solid #eee;flex-wrap:wrap}
.tpl-minimal .rci{font-size:11px;color:#999}
.tpl-minimal .rb{padding:8px 50px 40px}
.tpl-minimal .rst{font-size:9px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#bbb;margin-bottom:12px;margin-top:22px}
.tpl-minimal .rst:first-child{margin-top:0}
.tpl-minimal .re{margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #f4f4f4}
.tpl-minimal .re:last-child{border-bottom:none;padding-bottom:0}
.tpl-minimal .ret{display:flex;justify-content:space-between;align-items:baseline}
.tpl-minimal .retitle{font-size:14px;font-weight:600;color:#111}
.tpl-minimal .redate{font-size:11px;color:#ccc}
.tpl-minimal .resub{font-size:12px;color:#888;margin-top:2px}
.tpl-minimal .redesc{font-size:12px;color:#666;line-height:1.7;margin-top:7px}
.tpl-minimal .rebl{list-style:none;margin-top:7px}
.tpl-minimal .rebl li{font-size:12px;color:#666;line-height:1.6;padding:2px 0 2px 12px;position:relative}
.tpl-minimal .rebl li::before{content:'–';position:absolute;left:0;color:#ccc}
.tpl-minimal .rsk{display:flex;flex-wrap:wrap;gap:5px}
.tpl-minimal .rskp{font-size:11px;color:#666;background:#f5f5f5;padding:3px 10px;border-radius:2px}
.tpl-minimal .rsum{font-size:13px;color:#666;line-height:1.75}
/* All other templates share similar patterns — abbreviated for brevity */
.tpl-corporate .rh,.tpl-modern .rh,.tpl-classic .rh,.tpl-tech .rh,.tpl-elegant .rh{padding:36px 50px 22px}
.tpl-corporate .rh{text-align:center;border-bottom:2.5px double #1c2b4a}
.tpl-modern .rh{background:#0f0f1a;color:#fff}
.tpl-tech .rh{background:#0d1117;display:flex;justify-content:space-between;gap:20px}
.tpl-bold .rh-bar{background:#1a1a2e;padding:28px 48px}
.tpl-bold .rh-accent{background:#e63946;height:5px}
.tpl-bold .rh-sub{background:#f8f8fc;padding:12px 48px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e8e8ee}
[class*="tpl-"] .rn{font-size:28px;font-weight:700;color:#111;line-height:1.1}
.tpl-modern .rn,.tpl-tech .rn,.tpl-bold .rn{color:#fff;font-family:'Syne',sans-serif;font-size:26px;font-weight:800}
.tpl-corporate .rn{font-family:'Lora',serif;font-size:28px;color:#1c2b4a;text-align:center}
.tpl-elegant .rn{font-family:'Lora',serif;color:#1a1208}
[class*="tpl-"] .rt{font-size:13px;color:#666;margin-top:4px}
.tpl-modern .rt{color:#a5b4fc}
.tpl-tech .rt{color:#58a6ff}
.tpl-bold .rt{color:#1a1a2e;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:1.5px}
[class*="tpl-"] .rc{display:flex;gap:16px;margin-top:12px;flex-wrap:wrap}
.tpl-modern .rc{margin-top:12px}
.tpl-tech .rc{flex-direction:column;align-items:flex-end;gap:4px;margin-top:0}
.tpl-bold .rc{display:flex;gap:14px;flex-wrap:wrap}
[class*="tpl-"] .rci{font-size:12px;color:#888}
.tpl-modern .rci{color:#c7d2fe}
.tpl-tech .rci{color:#8b949e;font-size:11px}
[class*="tpl-"] .rb{padding:26px 50px 40px}
[class*="tpl-"] .rst{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4f46e5;margin-bottom:12px;padding-bottom:5px;border-bottom:1.5px solid #e8e8f4;margin-top:22px}
[class*="tpl-"] .rst:first-child{margin-top:0}
.tpl-corporate .rst{color:#1c2b4a;border-bottom-color:#1c2b4a;font-family:'Lora',serif;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.tpl-classic .rst{color:#222;border-bottom-color:#222}
.tpl-tech .rst{color:#58a6ff;border-bottom-color:#21262d}
.tpl-elegant .rst{color:#1a1208;border-bottom-color:#d4c4a8;font-family:'Lora',serif;font-size:14px;font-weight:600;font-style:italic;letter-spacing:0}
.tpl-bold .rst{color:#fff;background:#1a1a2e;display:inline-block;padding:4px 12px;border-radius:3px;border-bottom:none;font-family:'Syne',sans-serif;font-size:10px;font-weight:800;letter-spacing:2px}
[class*="tpl-"] .re{margin-bottom:14px}
[class*="tpl-"] .ret{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
[class*="tpl-"] .retitle{font-weight:700;font-size:13px;color:#111}
[class*="tpl-"] .redate{font-size:11px;color:#999;white-space:nowrap}
[class*="tpl-"] .resub{font-size:12px;color:#4f46e5;font-weight:600;margin-top:2px}
.tpl-corporate .resub,.tpl-classic .resub{color:#5a7090}
.tpl-tech .resub{color:#58a6ff}
.tpl-elegant .resub{color:#8b7355;font-style:italic}
.tpl-bold .resub{color:#e63946}
[class*="tpl-"] .redesc{font-size:12px;color:#444;line-height:1.7;margin-top:7px}
[class*="tpl-"] .rebl{list-style:none;margin-top:7px}
[class*="tpl-"] .rebl li{font-size:12px;color:#444;line-height:1.6;padding:2px 0 2px 14px;position:relative}
[class*="tpl-"] .rebl li::before{content:'▸';position:absolute;left:0;color:#4f46e5;font-size:9px;top:4px}
.tpl-corporate .rebl li::before,.tpl-classic .rebl li::before{content:'–';color:#aaa;font-size:12px;top:2px}
.tpl-tech .rebl li::before{content:'›';color:#58a6ff;font-size:16px;top:0;font-weight:700}
.tpl-bold .rebl li::before{content:'▶';color:#e63946;font-size:8px;top:4px}
[class*="tpl-"] .rsk{display:flex;flex-wrap:wrap;gap:6px}
[class*="tpl-"] .rskp{font-size:11px;background:#f0f0f8;color:#333;padding:4px 11px;border-radius:3px;border:1px solid #ddd}
.tpl-modern .rskp{background:#eef2ff;color:#4f46e5;border-color:#c7d2fe;border-radius:20px;font-weight:600}
.tpl-tech .rskp{font-family:'IBM Plex Sans',monospace;background:#f6f8fa;border-color:#d0d7de;border-radius:6px}
.tpl-elegant .rskp{background:#fdf6ec;color:#5a4520;border-color:#e4d8c4}
.tpl-bold .rskp{border-left:3px solid #e63946;border-radius:4px;background:#f8f8fc;font-weight:600}
[class*="tpl-"] .rsum{font-size:13px;color:#444;line-height:1.75}

::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}

@media(max-width:900px){
  .app-shell{grid-template-columns:1fr}
  .preview-pane{display:none}
  .features-grid,.testimonials-grid,.pricing-grid,.stats-row{grid-template-columns:1fr}
  .resumes-grid{grid-template-columns:1fr 1fr}
  .hero-title{font-size:36px}
}
`;

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function TagInput({ tags, onChange, placeholder }) {
  const [val, setVal] = useState("");
  const ref = useRef();
  const add = v => { const t = v.trim(); if (t && !tags.includes(t)) onChange([...tags, t]); setVal(""); };
  const rem = t => onChange(tags.filter(x => x !== t));
  return (
    <div className="tag-input-container" onClick={() => ref.current?.focus()}>
      {tags.map(t => <span key={t} className="tag">{t}<span className="tag-remove" onClick={() => rem(t)}>×</span></span>)}
      <input ref={ref} className="tag-input" value={val} placeholder={tags.length ? "" : placeholder}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(val); } if (e.key === "Backspace" && !val && tags.length) rem(tags[tags.length - 1]); }}
        onBlur={() => val.trim() && add(val)} />
    </div>
  );
}

function Spinner({ lg }) { return <div className={lg ? "spinner-lg" : "spinner"} />; }

// ─── RESUME PREVIEW ───────────────────────────────────────────────────────────
function ResumePreview({ data }) {
  const { personal_info: p = {}, experience = [], education = [], skills = [], certifications = [], template: tpl = "executive" } = data;
  const Ci = () => <>{[p.email,p.phone,p.location,p.linkedin,p.website].filter(Boolean).map((x,i)=><span key={i} className="rci">{x}</span>)}</>;
  const Bl = ({ exp }) => exp.bullets?.length > 0
    ? <ul className="rebl">{exp.bullets.map((b,i)=><li key={i}>{b}</li>)}</ul>
    : exp.description ? <div className="redesc">{exp.description}</div> : null;
  const Sec = ({ title, children }) => <div><div className="rst">{title}</div>{children}</div>;
  const Exp = ({ e }) => <div className="re"><div className="ret"><div className="retitle">{e.jobTitle}</div><div className="redate">{e.startDate}{e.startDate&&"–"}{e.current?"Present":e.endDate}</div></div><div className="resub">{e.company}{e.company&&e.location?"·":""}{e.location}</div><Bl exp={e}/></div>;
  const Edu = ({ e }) => <div className="re"><div className="ret"><div className="retitle">{e.degree}</div><div className="redate">{e.startDate}{e.startDate&&"–"}{e.endDate}</div></div><div className="resub">{e.school}</div>{e.description&&<div className="redesc">{e.description}</div>}</div>;
  const Cert = ({ c }) => <div className="re"><div className="ret"><div className="retitle">{c.name}</div><div className="redate">{c.date}</div></div><div className="resub">{c.issuer}</div></div>;
  const Sk = () => <div className="rsk">{skills.map(s=><span key={s} className="rskp">{s}</span>)}</div>;

  const body = <>
    {p.summary&&<Sec title="Summary"><div className="rsum">{p.summary}</div></Sec>}
    {experience.length>0&&<Sec title="Work Experience">{experience.map(e=><Exp key={e.id||e.jobTitle} e={e}/>)}</Sec>}
    {education.length>0&&<Sec title="Education">{education.map(e=><Edu key={e.id||e.degree} e={e}/>)}</Sec>}
    {skills.length>0&&<Sec title="Skills"><Sk/></Sec>}
    {certifications.length>0&&<Sec title="Certifications">{certifications.map(c=><Cert key={c.id||c.name} c={c}/>)}</Sec>}
  </>;

  if (tpl === "bold") return (
    <div className={`resume-sheet tpl-bold`}>
      <div className="rh-bar"><div className="rn">{p.fullName||"Your Name"}</div></div>
      <div className="rh-accent"/>
      <div className="rh-sub"><div className="rt">{p.jobTitle||"Title"}</div><div className="rc"><Ci/></div></div>
      <div className="rb">{body}</div>
    </div>
  );
  if (tpl === "tech") return (
    <div className={`resume-sheet tpl-tech`}>
      <div className="rh"><div><div className="rn">{p.fullName||"Your Name"}</div><div className="rt">{p.jobTitle||"Title"}</div></div><div className="rc"><Ci/></div></div>
      <div className="rb">{body}</div>
    </div>
  );
  return (
    <div className={`resume-sheet tpl-${tpl}`}>
      <div className="rh"><div className="rn">{p.fullName||"Your Name"}</div><div className="rt">{p.jobTitle||"Title"}</div><div className="rc"><Ci/></div></div>
      <div className="rb">{body}</div>
    </div>
  );
}

// ─── BUILDER STEP COMPONENTS ──────────────────────────────────────────────────
function BuilderSteps({ data, setData, step, plan, showToast }) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiSummary, setAiSummary] = useState("");
  const [activeBulletExp, setActiveBulletExp] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);

  const upP = (f, v) => setData(d => ({ ...d, personal_info: { ...d.personal_info, [f]: v } }));
  const addExp = () => setData(d => ({ ...d, experience: [...d.experience, { id: uid(), jobTitle:"", company:"", location:"", startDate:"", endDate:"", current:false, description:"", bullets:[] }] }));
  const upExp = (id, f, v) => setData(d => ({ ...d, experience: d.experience.map(e => e.id===id?{...e,[f]:v}:e) }));
  const remExp = id => setData(d => ({ ...d, experience: d.experience.filter(e => e.id!==id) }));
  const remBullet = (expId, idx) => setData(d => ({ ...d, experience: d.experience.map(e => e.id===expId?{...e,bullets:e.bullets.filter((_,i)=>i!==idx)}:e) }));
  const addEdu = () => setData(d => ({ ...d, education: [...d.education, { id:uid(), degree:"", school:"", location:"", startDate:"", endDate:"", description:"" }] }));
  const upEdu = (id, f, v) => setData(d => ({ ...d, education: d.education.map(e => e.id===id?{...e,[f]:v}:e) }));
  const remEdu = id => setData(d => ({ ...d, education: d.education.filter(e => e.id!==id) }));
  const addCert = () => setData(d => ({ ...d, certifications: [...d.certifications, { id:uid(), name:"", issuer:"", date:"" }] }));
  const upCert = (id, f, v) => setData(d => ({ ...d, certifications: d.certifications.map(c => c.id===id?{...c,[f]:v}:c) }));
  const remCert = id => setData(d => ({ ...d, certifications: d.certifications.filter(c => c.id!==id) }));

  const genBullets = async exp => {
    setActiveBulletExp(exp.id); setAiLoading(true); setAiSuggestions([]);
    try {
      const { bullets } = await api.ai.bullets(exp.jobTitle||"professional", exp.company, data.job_description, 5);
      setAiSuggestions(bullets||[]);
    } catch(e) { showToast(e.message||"AI failed","error"); }
    setAiLoading(false);
  };

  const applyBullet = b => {
    if (!activeBulletExp) return;
    setData(d => ({ ...d, experience: d.experience.map(e => e.id===activeBulletExp?{...e,bullets:[...(e.bullets||[]),b]}:e) }));
    setAiSuggestions(s => s.filter(x => x!==b));
    showToast("Bullet added ✓","success");
  };

  const genSummary = async () => {
    setAiLoading(true);
    try {
      const { summary } = await api.ai.summary(data.personal_info.jobTitle, data.experience, data.skills);
      setAiSummary(summary);
    } catch(e) { showToast(e.message||"AI failed","error"); }
    setAiLoading(false);
  };

  const runMatch = async () => {
    if (!data.job_description?.trim()) { showToast("Paste a job description first","warning"); return; }
    if (plan==="free") { showToast("Job Match is a Pro feature","warning"); return; }
    setMatchLoading(true); setMatchResult(null);
    try { const r = await api.ai.match(data, data.job_description); setMatchResult(r); }
    catch(e) { showToast(e.message||"Analysis failed","error"); }
    setMatchLoading(false);
  };

  switch(step) {
    case 0: return (
      <div className="sidebar-body">
        <div className="ai-panel">
          <div className="ai-panel-header"><span className="ai-badge">AI</span><h3>Write My Summary</h3></div>
          <p style={{fontSize:13,color:"#4338ca",marginBottom:10,lineHeight:1.5}}>AI crafts your summary from experience and skills.</p>
          <button className="btn btn-primary btn-sm" onClick={genSummary} disabled={aiLoading}>{aiLoading?"✨ Writing...":"✨ Generate"}</button>
          {aiSummary && <>
            <div className="ai-suggestion" style={{marginTop:12}}>{aiSummary}</div>
            <div style={{display:"flex",gap:8}}><button className="btn btn-primary btn-sm" onClick={()=>{upP("summary",aiSummary);setAiSummary("");showToast("Applied ✓","success");}}>Apply</button><button className="btn btn-secondary btn-sm" onClick={genSummary}>Retry</button></div>
          </>}
        </div>
        {[["fullName","Full Name","Your Full Name"],["jobTitle","Job Title","Senior Software Engineer"],["email","Email","you@example.com"],["phone","Phone","+234 800 000 0000"],["location","Location","Lagos, Nigeria"],["linkedin","LinkedIn","linkedin.com/in/yourname"],["website","Portfolio","yoursite.com"]].map(([f,l,ph])=>(
          <div className="field" key={f}><label>{l}</label><input value={data.personal_info[f]||""} onChange={e=>upP(f,e.target.value)} placeholder={ph}/></div>
        ))}
        <div className="field"><label>Professional Summary</label><textarea value={data.personal_info.summary||""} onChange={e=>upP("summary",e.target.value)} placeholder="A brief, powerful statement about your value..." rows={4}/></div>
      </div>
    );

    case 1: return (
      <div className="sidebar-body">
        <button className="btn btn-primary btn-sm" onClick={addExp} style={{marginBottom:14}}>+ Add Experience</button>
        {!data.experience.length && <div className="empty-state"><div className="empty-icon">💼</div><h3>No experience yet</h3><p>Add your work history above</p></div>}
        {data.experience.map((exp,idx) => (
          <div className="card card-sm" key={exp.id} style={{marginBottom:12}}>
            <div className="card-header">
              <span className="card-title">{exp.jobTitle||`Experience ${idx+1}`}</span>
              <div style={{display:"flex",gap:6}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>genBullets(exp)} disabled={aiLoading}>✨ AI</button>
                <button className="btn btn-danger btn-sm" onClick={()=>remExp(exp.id)}>✕</button>
              </div>
            </div>
            <div className="field"><label>Job Title</label><input value={exp.jobTitle} onChange={e=>upExp(exp.id,"jobTitle",e.target.value)} placeholder="Software Engineer"/></div>
            <div className="field"><label>Company</label><input value={exp.company} onChange={e=>upExp(exp.id,"company",e.target.value)} placeholder="Acme Corp"/></div>
            <div className="field"><label>Location</label><input value={exp.location} onChange={e=>upExp(exp.id,"location",e.target.value)} placeholder="Lagos, Nigeria"/></div>
            <div className="field-row">
              <div className="field"><label>Start</label><input type="month" value={exp.startDate} onChange={e=>upExp(exp.id,"startDate",e.target.value)}/></div>
              <div className="field"><label>End</label><input type="month" value={exp.endDate} onChange={e=>upExp(exp.id,"endDate",e.target.value)} disabled={exp.current}/></div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <input type="checkbox" id={`c-${exp.id}`} checked={exp.current} onChange={e=>upExp(exp.id,"current",e.target.checked)} style={{width:"auto"}}/><label htmlFor={`c-${exp.id}`} style={{fontSize:13,fontWeight:400,margin:0}}>Currently here</label>
            </div>
            {(exp.bullets||[]).length>0 && (
              <div className="field"><label>Bullet Points</label>
                {exp.bullets.map((b,i)=><div key={i} style={{display:"flex",gap:8,marginBottom:6,alignItems:"flex-start"}}><div style={{flex:1,fontSize:13,color:"#2e2e42",lineHeight:1.5,padding:"7px 10px",background:"#f7f7fc",borderRadius:6,border:"1px solid #e2e2ee"}}>{b}</div><button className="btn btn-danger btn-sm" style={{padding:"4px 8px",flexShrink:0}} onClick={()=>remBullet(exp.id,i)}>✕</button></div>)}
              </div>
            )}
            <div className="field"><label>Description</label><textarea value={exp.description} onChange={e=>upExp(exp.id,"description",e.target.value)} placeholder="Key responsibilities..." rows={2}/></div>
            {activeBulletExp===exp.id && aiLoading && <div className="ai-loading"><Spinner/>Generating bullets...</div>}
            {activeBulletExp===exp.id && aiSuggestions.length>0 && (
              <div className="ai-panel" style={{marginTop:8}}>
                <div className="ai-panel-header"><span className="ai-badge">AI</span><h3>Click to add</h3></div>
                {aiSuggestions.map((s,i)=><div key={i} className="ai-suggestion" onClick={()=>applyBullet(s)}>+ {s}</div>)}
              </div>
            )}
          </div>
        ))}
      </div>
    );

    case 2: return (
      <div className="sidebar-body">
        <button className="btn btn-primary btn-sm" onClick={addEdu} style={{marginBottom:14}}>+ Add Education</button>
        {!data.education.length && <div className="empty-state"><div className="empty-icon">🎓</div><h3>No education yet</h3><p>Add your academic background</p></div>}
        {data.education.map((edu,idx) => (
          <div className="card card-sm" key={edu.id} style={{marginBottom:12}}>
            <div className="card-header"><span className="card-title">{edu.degree||`Education ${idx+1}`}</span><button className="btn btn-danger btn-sm" onClick={()=>remEdu(edu.id)}>✕</button></div>
            <div className="field"><label>Degree</label><input value={edu.degree} onChange={e=>upEdu(edu.id,"degree",e.target.value)} placeholder="B.Sc Computer Science"/></div>
            <div className="field"><label>School</label><input value={edu.school} onChange={e=>upEdu(edu.id,"school",e.target.value)} placeholder="University of Lagos"/></div>
            <div className="field-row">
              <div className="field"><label>Start</label><input type="month" value={edu.startDate} onChange={e=>upEdu(edu.id,"startDate",e.target.value)}/></div>
              <div className="field"><label>End</label><input type="month" value={edu.endDate} onChange={e=>upEdu(edu.id,"endDate",e.target.value)}/></div>
            </div>
            <div className="field"><label>Notes</label><textarea value={edu.description} onChange={e=>upEdu(edu.id,"description",e.target.value)} rows={2} placeholder="GPA, honors..."/></div>
          </div>
        ))}
      </div>
    );

    case 3: return (
      <div className="sidebar-body">
        <div className="field"><label>Skills</label><TagInput tags={data.skills} onChange={skills=>setData(d=>({...d,skills}))} placeholder="Type a skill, press Enter..."/><div className="field-hint">Press Enter or comma after each skill</div></div>
        <div className="ai-panel">
          <div className="ai-panel-header"><span className="ai-badge">AI</span><h3>Suggest Skills</h3></div>
          <p style={{fontSize:13,color:"#4338ca",marginBottom:10}}>Get relevant skills for your job title.</p>
          <button className="btn btn-primary btn-sm" disabled={aiLoading} onClick={async()=>{
            setAiLoading(true);
            try{const{skills:s}=await api.ai.skills(data.personal_info.jobTitle||"professional",12);setAiSuggestions(s||[]);}
            catch(e){showToast(e.message||"AI failed","error");}
            setAiLoading(false);
          }}>{aiLoading?"✨ Loading...":"✨ Suggest"}</button>
          {aiSuggestions.length>0&&<div style={{marginTop:12,display:"flex",flexWrap:"wrap",gap:6}}>
            {aiSuggestions.map(s=><span key={s} className="tag" style={{cursor:"pointer"}} onClick={()=>{if(!data.skills.includes(s))setData(d=>({...d,skills:[...d.skills,s]}));setAiSuggestions(p=>p.filter(x=>x!==s));}}>+ {s}</span>)}
          </div>}
        </div>
      </div>
    );

    case 4: return (
      <div className="sidebar-body">
        <button className="btn btn-primary btn-sm" onClick={addCert} style={{marginBottom:14}}>+ Add Certification</button>
        {!data.certifications.length && <div className="empty-state"><div className="empty-icon">🏆</div><h3>No certifications yet</h3><p>Add licenses, awards, or certs</p></div>}
        {data.certifications.map((c,idx) => (
          <div className="card card-sm" key={c.id} style={{marginBottom:12}}>
            <div className="card-header"><span className="card-title">{c.name||`Cert ${idx+1}`}</span><button className="btn btn-danger btn-sm" onClick={()=>remCert(c.id)}>✕</button></div>
            <div className="field"><label>Name</label><input value={c.name} onChange={e=>upCert(c.id,"name",e.target.value)} placeholder="AWS Solutions Architect"/></div>
            <div className="field"><label>Issuer</label><input value={c.issuer} onChange={e=>upCert(c.id,"issuer",e.target.value)} placeholder="Amazon Web Services"/></div>
            <div className="field"><label>Date</label><input type="month" value={c.date} onChange={e=>upCert(c.id,"date",e.target.value)}/></div>
          </div>
        ))}
      </div>
    );

    case 5: return (
      <div className="sidebar-body">
        <div className="alert alert-info" style={{marginBottom:16}}>✅ All 8 templates are ATS-optimized — no tables or columns that break parsers.</div>
        <div className="tpl-picker">
          {TEMPLATES.map(t=>(
            <div key={t.id} className={`tpl-card ${data.template===t.id?"active":""}`} onClick={()=>setData(d=>({...d,template:t.id}))}>
              <div className="tpl-thumb" style={{background:t.hBg}}>
                <div style={{height:"40%",padding:"5px 6px"}}><div style={{height:4,width:"65%",background:t.hC,borderRadius:2,opacity:.85}}/><div style={{height:2,width:"40%",background:t.hC,borderRadius:1,opacity:.4,marginTop:3}}/></div>
                <div style={{flex:1,background:"#fff",padding:"4px 6px"}}>{[55,70,45,60].map((w,i)=><div key={i} style={{height:2,width:`${w}%`,background:"#e2e2ee",borderRadius:1,margin:"2px 0"}}/>)}</div>
              </div>
              <div className="tpl-label">{t.label}</div><div className="ats-badge">ATS ✓</div>
            </div>
          ))}
        </div>
        {(() => { const t = TEMPLATES.find(x=>x.id===data.template); return t&&<div className="alert alert-success">Selected: <strong>{t.label}</strong> — Best for {t.best}</div>; })()}
      </div>
    );

    case 6: return (
      <div className="sidebar-body">
        {plan==="free" && <div className="alert alert-warning">🔒 Job Match Score requires Pro plan.</div>}
        <div className="field"><label>Paste Job Description</label><textarea value={data.job_description||""} onChange={e=>setData(d=>({...d,job_description:e.target.value}))} placeholder="Paste the full job posting here..." rows={9}/></div>
        <button className="btn btn-primary btn-full" onClick={runMatch} disabled={matchLoading||plan==="free"}>
          {matchLoading?"🔍 Analysing...":"🎯 Run Match Analysis"}
        </button>
        {matchResult && (
          <div className="match-box">
            <div className="match-number">{matchResult.score}%</div>
            <div style={{fontSize:14,color:"var(--success)",fontWeight:600,marginTop:4}}>{matchResult.label||"Analysis Complete"}</div>
            <div className="match-bar"><div className="match-fill" style={{width:`${matchResult.score}%`}}/></div>
            {matchResult.tips?.map((tip,i)=><div key={i} className="match-tip"><span style={{fontSize:15}}>💡</span><span>{tip}</span></div>)}
            {matchResult.missing_keywords?.length>0 && (
              <div style={{marginTop:12,textAlign:"left"}}>
                <div style={{fontSize:12,fontWeight:700,color:"var(--success)",marginBottom:6}}>MISSING KEYWORDS</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {matchResult.missing_keywords.map(k=><span key={k} style={{fontSize:11,background:"#fff",border:"1px solid #86efac",color:"#059669",padding:"2px 8px",borderRadius:20}}>{k}</span>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}

// ─── IMPORT MODAL ─────────────────────────────────────────────────────────────
function ImportModal({ onClose, onImport, showToast }) {
  const [tab, setTab] = useState("paste");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const doImport = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      // Ask Claude to parse the resume text into structured data
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: "You are a resume parser. Extract structured data from resume text. Return only valid JSON.",
          messages: [{ role: "user", content: `Parse this resume into JSON with this exact structure:\n{"personal_info":{"fullName":"","jobTitle":"","email":"","phone":"","location":"","linkedin":"","website":"","summary":""},"experience":[{"jobTitle":"","company":"","location":"","startDate":"","endDate":"","current":false,"description":"","bullets":[]}],"education":[{"degree":"","school":"","location":"","startDate":"","endDate":"","description":""}],"skills":[],"certifications":[]}\n\nResume:\n${text.slice(0,3000)}` }]
        })
      });
      const d = await resp.json();
      const raw = d.content?.[0]?.text?.replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(raw);
      // Add IDs
      if (parsed.experience) parsed.experience = parsed.experience.map(e=>({...e,id:uid()}));
      if (parsed.education) parsed.education = parsed.education.map(e=>({...e,id:uid()}));
      if (parsed.certifications) parsed.certifications = parsed.certifications.map(c=>({...c,id:uid()}));
      onImport(parsed);
      showToast("Resume imported successfully! ✓","success");
      onClose();
    } catch(e) { showToast("Parse failed — try pasting cleaner text","error"); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">Import Existing Resume</div>
        <div className="modal-desc">AI will parse your resume and pre-fill the builder. Review and edit after import.</div>
        <div className="import-tabs">
          {["paste","upload"].map(t=><button key={t} className={`import-tab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>{t==="paste"?"📋 Paste Text":"📄 Upload PDF"}</button>)}
        </div>
        {tab==="paste" && <div className="field"><label>Paste your resume text</label><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Copy and paste your entire resume here..." rows={10}/></div>}
        {tab==="upload" && (
          <div style={{border:"2px dashed var(--border)",borderRadius:"var(--radius-sm)",padding:32,textAlign:"center",color:"var(--muted)"}}>
            <div style={{fontSize:32,marginBottom:8}}>📄</div>
            <p style={{fontSize:14,marginBottom:8}}>PDF upload requires the backend running locally.</p>
            <p style={{fontSize:12}}>Switch to "Paste Text" tab for instant AI import.</p>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={doImport} disabled={!text.trim()||loading}>
            {loading?<><Spinner/> Parsing...</>:"✨ Import & Parse"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PAYSTACK MODAL ───────────────────────────────────────────────────────────
function PaystackModal({ plan, defaultEmail, onClose, onSuccess, showToast }) {
  const [email, setEmail] = useState(defaultEmail||"");
  const [loading, setLoading] = useState(false);

  const pay = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const { authorization_url } = await api.payments.initialize(plan.id, email);
      window.location.href = authorization_url;
    } catch(e) {
      showToast(e.message||"Payment init failed","error");
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">Upgrade to {plan.name}</div>
        <div className="modal-desc">Charged <strong>{plan.price}{plan.period}</strong> via Paystack. Instant access after payment.</div>
        <div className="field"><label>Email Address</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div>
        <div className="alert alert-info">🔒 Secured by Paystack — card details never stored with us.</div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={pay} disabled={!email||loading}>
            {loading?<><Spinner/> Redirecting...</>:`Pay ${plan.price} →`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGES
// ═══════════════════════════════════════════════════════════════

// ── LANDING ───────────────────────────────────────────────────
function LandingPage({ onNav }) {
  const features = [
    { icon:"🤖", title:"AI-Powered Content", desc:"Claude AI writes bullet points tailored to the exact job posting — not generic templates." },
    { icon:"🎯", title:"Job Match Score", desc:"Paste a job description and get a % match score with specific improvements to hit 90%+." },
    { icon:"✅", title:"100% ATS-Safe", desc:"All 8 templates are tested against major ATS systems. Clean fonts, no tables, no columns." },
    { icon:"💸", title:"Honest Pricing", desc:"No 4-week billing tricks. No auto-renewal surprises. Real monthly and lifetime options." },
    { icon:"📄", title:"PDF + DOCX Export", desc:"Download your resume as a print-ready PDF or editable Word document in one click." },
    { icon:"⚡", title:"Live Preview", desc:"See your resume update in real time as you type. What you see is what you download." },
  ];
  const testimonials = [
    { text:"The job match score feature helped me tailor my resume for each application. Got 3 interviews in the first week.", author:"Adebayo O.", role:"Software Engineer, Lagos", stars:5 },
    { text:"Finally a resume builder with honest pricing. No hidden fees. And the AI bullets are actually specific, not generic.", author:"Chisom N.", role:"Marketing Manager, Abuja", stars:5 },
    { text:"I used ResumeNow before and got charged for 3 months I didn't use. CVCraft is so much better — and cheaper.", author:"Emeka T.", role:"Product Manager, Port Harcourt", stars:5 },
  ];

  return (
    <>
      <section className="hero">
        <div className="hero-eyebrow">🇳🇬 Built for Nigerian professionals</div>
        <h1 className="hero-title">Build a resume that<br/><span>beats ResumeNow</span></h1>
        <p className="hero-sub">AI-powered bullet points, 8 ATS-safe templates, and honest NGN pricing. No 4-week billing tricks.</p>
        <div className="hero-actions">
          <button className="btn btn-primary btn-xl" onClick={()=>onNav("register")}>Build My Resume Free →</button>
          <button className="btn btn-secondary btn-lg" onClick={()=>onNav("pricing")}>See Pricing</button>
        </div>
        <div className="hero-trust">
          {[["✅","ATS-Optimized Templates"],["🤖","Claude AI Built-In"],["🔒","Secured by Paystack"],["⚡","Live Preview"]].map(([i,t])=>(
            <div key={t} className="trust-item"><span>{i}</span><span>{t}</span></div>
          ))}
        </div>
      </section>

      <section className="templates-section">
        <div style={{textAlign:"center"}}>
          <div className="section-label">Templates</div>
          <h2 className="section-title">8 ATS-Optimized Templates</h2>
          <p className="section-sub">Every template tested against Workday, Greenhouse, Lever, and iCIMS. All pass with 100% parse accuracy.</p>
        </div>
        <div className="templates-scroll">
          {TEMPLATES.map(t=>(
            <div key={t.id} className="tpl-showcase" onClick={()=>onNav("register")}>
              <div className="tpl-showcase-head" style={{background:t.hBg}}>
                <div style={{height:5,width:"60%",background:t.hC,borderRadius:2,opacity:.9,marginBottom:4}}/>
                <div style={{height:3,width:"40%",background:t.hC,borderRadius:1,opacity:.5}}/>
              </div>
              <div className="tpl-showcase-body">
                {[65,80,50,70,45,60].map((w,i)=><div key={i} className="tpl-showcase-line" style={{width:`${w}%`}}/>)}
              </div>
              <div className="tpl-showcase-label">
                <div className="tpl-showcase-name">{t.label}</div>
                <div className="tpl-showcase-best">{t.best}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="features-section">
        <div style={{textAlign:"center"}}>
          <div className="section-label">Why CVCraft</div>
          <h2 className="section-title">Everything ResumeNow lacks</h2>
          <p className="section-sub">We built CVCraft to fix every complaint about existing resume builders.</p>
        </div>
        <div className="features-grid">
          {features.map(f=>(
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="social-proof">
        <div className="section-label" style={{color:"#a5b4fc"}}>Testimonials</div>
        <h2 className="section-title" style={{color:"#fff",marginBottom:8}}>Used by Nigerian professionals</h2>
        <p style={{color:"#8b949e",fontSize:15}}>From Lagos to Abuja, CVCraft is helping job seekers land interviews.</p>
        <div className="testimonials-grid">
          {testimonials.map((t,i)=>(
            <div key={i} className="testimonial">
              <div className="testimonial-stars">{"★".repeat(t.stars)}</div>
              <div className="testimonial-text">"{t.text}"</div>
              <div className="testimonial-author">{t.author}</div>
              <div className="testimonial-role">{t.role}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <div className="section-label">Get Started</div>
        <h2 className="section-title" style={{marginBottom:16}}>Your next interview starts here</h2>
        <p className="section-sub" style={{marginBottom:36}}>Free to start. No credit card required. Upgrade when you're ready.</p>
        <button className="btn btn-primary btn-xl" onClick={()=>onNav("register")}>Build My Resume Free →</button>
      </section>
    </>
  );
}

// ── AUTH ──────────────────────────────────────────────────────
function AuthPage({ mode, onNav, onLogin, showToast }) {
  const [isLogin, setIsLogin] = useState(mode === "login");
  const [form, setForm] = useState({ email:"", password:"", fullName:"" });
  const [loading, setLoading] = useState(false);

  const up = (f, v) => setForm(x => ({ ...x, [f]: v }));

  const submit = async () => {
    if (!form.email || !form.password) { showToast("Fill in all fields","warning"); return; }
    setLoading(true);
    try {
      if (isLogin) {
        const { user } = await api.auth.login(form.email, form.password);
        onLogin(user);
        showToast(`Welcome back! 👋`,"success");
      } else {
        await api.auth.register(form.email, form.password, form.fullName);
        const { user } = await api.auth.login(form.email, form.password);
        onLogin(user);
        showToast("Account created! 🎉","success");
      }
    } catch(e) { showToast(e.message||"Auth failed","error"); }
    setLoading(false);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-title">{isLogin ? "Welcome back" : "Create your account"}</div>
        <div className="auth-sub">{isLogin ? "Sign in to access your resumes." : "Start building your ATS-optimized resume for free."}</div>
        {!isLogin && <div className="field"><label>Full Name</label><input value={form.fullName} onChange={e=>up("fullName",e.target.value)} placeholder="Your Full Name"/></div>}
        <div className="field"><label>Email</label><input type="email" value={form.email} onChange={e=>up("email",e.target.value)} placeholder="you@example.com" onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
        <div className="field"><label>Password</label><input type="password" value={form.password} onChange={e=>up("password",e.target.value)} placeholder="Min 8 characters" onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
        <button className="btn btn-primary btn-full" style={{marginTop:4}} onClick={submit} disabled={loading}>
          {loading?<><Spinner/>{isLogin?"Signing in...":"Creating account..."}</>:isLogin?"Sign In →":"Create Free Account →"}
        </button>
        <div className="auth-switch" style={{marginTop:20}}>
          {isLogin ? <>Don't have an account? <span onClick={()=>setIsLogin(false)}>Sign up free</span></>
                   : <>Already have an account? <span onClick={()=>setIsLogin(true)}>Sign in</span></>}
        </div>
        <div style={{textAlign:"center",marginTop:16}}><span className="nav-link btn-sm" style={{cursor:"pointer"}} onClick={()=>onNav("landing")}>← Back to home</span></div>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────
function DashboardPage({ user, plan, onNav, onOpenBuilder, showToast }) {
  const [resumes, setResumes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [payModal, setPayModal] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [r, s] = await Promise.all([api.resumes.list(), api.user.stats()]);
        setResumes(r.resumes||[]); setStats(s);
      } catch(e) { showToast(e.message||"Failed to load","error"); }
      setLoading(false);
    })();
  }, []);

  const deleteResume = async id => {
    setDeleting(id);
    try { await api.resumes.delete(id); setResumes(r=>r.filter(x=>x.id!==id)); showToast("Deleted","success"); }
    catch(e) { showToast(e.message||"Delete failed","error"); }
    setDeleting(null);
  };

  const downloadPDF = async (resume, e) => {
    e.stopPropagation();
    try { await api.export.pdf(resume.id, resume.personal_info?.fullName||"resume"); showToast("Downloaded ✓","success"); }
    catch(e) { showToast(e.message||"Export failed","error"); }
  };

  if (loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh"}}><Spinner lg/></div>;

  return (
    <div className="dashboard">
      {plan==="free" && (
        <div className="plan-banner">
          <div className="plan-banner-text">
            <h3>Unlock the full CVCraft experience</h3>
            <p>Upgrade to Pro for unlimited resumes, all 8 templates, Job Match Score, and DOCX export.</p>
          </div>
          <button className="btn btn-outline" style={{background:"white",color:"var(--accent)",border:"none",flexShrink:0}} onClick={()=>setPayModal(PLANS[1])}>Upgrade to Pro — ₦4,500/mo →</button>
        </div>
      )}
      <div className="dashboard-header">
        <div><div className="dashboard-title">My Resumes</div><div className="dashboard-sub">Welcome back, {user.email?.split("@")[0]} 👋</div></div>
        <div style={{display:"flex",gap:10}}>
          <button className="btn btn-secondary btn-sm" onClick={()=>onOpenBuilder(null,"import")}>📋 Import Resume</button>
          <button className="btn btn-primary" onClick={()=>onOpenBuilder(null)}>+ New Resume</button>
        </div>
      </div>

      {stats && (
        <div className="stats-row">
          <div className="stat-card"><div className="stat-label">Resumes</div><div className="stat-value">{stats.resume_count}</div><div className="stat-sub">{plan==="free"?"1 max on Free":"Unlimited"}</div></div>
          <div className="stat-card"><div className="stat-label">Downloads today</div><div className="stat-value">{stats.downloads_today}</div><div className="stat-sub">{plan==="free"?"1/day limit":""}</div></div>
          <div className="stat-card"><div className="stat-label">Plan</div><div className="stat-value" style={{fontSize:20,marginTop:4}}>{plan.charAt(0).toUpperCase()+plan.slice(1)}</div><div className="stat-sub">{plan==="free"?<span style={{color:"var(--accent)",cursor:"pointer",fontWeight:600}} onClick={()=>setPayModal(PLANS[1])}>Upgrade →</span>:"Active"}</div></div>
          <div className="stat-card"><div className="stat-label">ATS Templates</div><div className="stat-value">{plan==="free"?"5":"8"}</div><div className="stat-sub">Available to you</div></div>
        </div>
      )}

      <div className="resumes-grid">
        <div className="new-resume-card" onClick={()=>onOpenBuilder(null)}>
          <div className="new-resume-icon">➕</div>
          <div className="new-resume-label">New Resume</div>
          <span style={{fontSize:13,color:"var(--muted)"}}>Start from scratch</span>
        </div>
        {resumes.map(r=>(
          <div key={r.id} className="resume-card" onClick={()=>onOpenBuilder(r.id)}>
            <div className="resume-card-preview">
              {(() => { const t=TEMPLATES.find(x=>x.id===(r.template||"classic")); return (
                <div style={{background:t?.hBg||"#fff",height:"45%",padding:"10px 14px",display:"flex",flexDirection:"column",gap:4}}>
                  <div style={{height:5,width:"55%",background:t?.hC||"#111",borderRadius:2,opacity:.85}}/>
                  <div style={{height:3,width:"35%",background:t?.hC||"#111",borderRadius:1,opacity:.5}}/>
                </div>
              ); })()}
              <div style={{flex:1,padding:"10px 14px",display:"flex",flexDirection:"column",gap:4}}>
                {[65,80,50,70,45].map((w,i)=><div key={i} style={{height:2,width:`${w}%`,background:"#e2e2ee",borderRadius:1}}/>)}
              </div>
            </div>
            <div className="resume-card-body">
              <div className="resume-card-title">{r.title||"Untitled Resume"}</div>
              <div className="resume-card-meta">{TEMPLATES.find(x=>x.id===r.template)?.label||"Classic"} template · Updated {new Date(r.updated_at).toLocaleDateString()}</div>
              <div className="resume-card-actions" onClick={e=>e.stopPropagation()}>
                <button className="btn btn-secondary btn-sm" onClick={e=>downloadPDF(r,e)}>⬇ PDF</button>
                <button className="btn btn-primary btn-sm" onClick={()=>onOpenBuilder(r.id)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={()=>deleteResume(r.id)} disabled={deleting===r.id}>{deleting===r.id?"...":"✕"}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {payModal && <PaystackModal plan={payModal} defaultEmail={user.email} onClose={()=>setPayModal(null)} onSuccess={()=>{}} showToast={showToast}/>}
    </div>
  );
}

// ── BUILDER ───────────────────────────────────────────────────
function BuilderPage({ user, plan, resumeId, onNav, showToast }) {
  const [data, setData] = useState({ ...INIT_RESUME });
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(!!resumeId);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [payModal, setPayModal] = useState(null);
  const [savedId, setSavedId] = useState(resumeId||null);
  const autoSaveTimer = useRef(null);

  useEffect(() => {
    if (resumeId) {
      api.resumes.get(resumeId).then(r => { setData(r); setLoading(false); }).catch(e => { showToast(e.message,"error"); setLoading(false); });
    }
  }, [resumeId]);

  // Auto-save every 30s
  const save = useCallback(async (d) => {
    if (!_token) return;
    setSaving(true);
    try {
      if (savedId) { await api.resumes.update(savedId, d); }
      else { const { resume } = await api.resumes.create(d); setSavedId(resume.id); }
    } catch(e) { /* silent */ }
    setSaving(false);
  }, [savedId]);

  useEffect(() => {
    if (!_token) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => save(data), 30000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [data]);

  const manualSave = async () => {
    setSaving(true);
    try {
      if (savedId) { await api.resumes.update(savedId, data); showToast("Saved ✓","success"); }
      else { const { resume } = await api.resumes.create(data); setSavedId(resume.id); showToast("Saved ✓","success"); }
    } catch(e) { showToast(e.message||"Save failed","error"); }
    setSaving(false);
  };

  const exportPDF = async () => {
    try {
      const name = data.personal_info?.fullName || "resume";
      if (savedId) await api.export.pdf(savedId, name);
      else await api.export.pdf(data, name);
      showToast("Downloaded ✓","success");
    } catch(e) { showToast(e.message||"Export failed","error"); }
  };

  const exportDOCX = async () => {
    if (plan==="free") { showToast("DOCX export requires Pro plan","warning"); setPayModal(PLANS[1]); return; }
    try {
      const name = data.personal_info?.fullName || "resume";
      if (savedId) await api.export.docx(savedId, name);
      else await api.export.docx(data, name);
      showToast("Downloaded ✓","success");
    } catch(e) { showToast(e.message||"Export failed","error"); }
  };

  const progress = Math.round(((step+1)/STEPS.length)*100);
  const tplInfo = TEMPLATES.find(t=>t.id===data.template);

  if (loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh"}}><Spinner lg/></div>;

  return (
    <>
      {importing && <ImportModal onClose={()=>setImporting(false)} onImport={parsed=>setData(d=>({...d,...parsed}))} showToast={showToast}/>}
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <h2>Resume Builder</h2>
                <p>Step {step+1} of {STEPS.length} — {STEPS[step]}</p>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>setImporting(true)} title="Import">📋</button>
                <button className="btn btn-ghost btn-sm" onClick={manualSave} disabled={saving}>{saving?"💾...":"💾"}</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>onNav("dashboard")} title="Dashboard">🏠</button>
              </div>
            </div>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{width:`${progress}%`}}/></div>
          <div className="step-tabs">
            {STEPS.map((s,i)=>(
              <button key={s} className={`step-tab ${i===step?"active":i<step?"done":""}`} onClick={()=>setStep(i)}>
                {i<step?"✓ ":""}{s}
              </button>
            ))}
          </div>
          <BuilderSteps data={data} setData={setData} step={step} plan={plan} showToast={showToast}/>
          <div style={{padding:"14px 24px",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"space-between"}}>
            <button className="btn btn-secondary btn-sm" onClick={()=>setStep(s=>Math.max(0,s-1))} disabled={step===0}>← Back</button>
            <button className="btn btn-primary btn-sm" onClick={()=>setStep(s=>Math.min(STEPS.length-1,s+1))} disabled={step===STEPS.length-1}>
              {step===STEPS.length-2?"Finish →":"Next →"}
            </button>
          </div>
        </aside>

        <main className="preview-pane">
          <div style={{display:"flex",gap:12,alignSelf:"stretch",justifyContent:"space-between",alignItems:"center",background:"#fff",padding:"12px 20px",borderRadius:"var(--radius)",boxShadow:"var(--shadow)"}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14}}>Live Preview</span>
              <span style={{fontSize:12,color:"var(--muted)"}}>·</span>
              <span style={{fontSize:12,color:"var(--muted)"}}>{tplInfo?.label}</span>
              <span style={{fontSize:11,color:"var(--success)",background:"#dcfce7",padding:"2px 8px",borderRadius:20,fontWeight:700}}>ATS ✓</span>
              {saving && <span style={{fontSize:12,color:"var(--muted)"}}>Saving...</span>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-secondary btn-sm" onClick={exportDOCX}>⬇ DOCX</button>
              <button className="btn btn-primary btn-sm" onClick={exportPDF}>⬇ PDF</button>
            </div>
          </div>
          <div style={{transform:"scale(0.72)",transformOrigin:"top center",marginBottom:-320}}>
            <ResumePreview data={data}/>
          </div>
        </main>
      </div>
      {payModal && <PaystackModal plan={payModal} defaultEmail={user?.email} onClose={()=>setPayModal(null)} onSuccess={()=>{}} showToast={showToast}/>}
    </>
  );
}

// ── PAYMENT CALLBACK ──────────────────────────────────────────
function PaymentCallbackPage({ onNav, showToast }) {
  const [status, setStatus] = useState("verifying"); // verifying | success | failed
  const [plan, setPlan] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("reference") || params.get("trxref");
    const planParam = params.get("plan") || localStorage.getItem("cvcraft_pending_plan") || "pro";

    if (!ref) { setStatus("failed"); return; }

    api.payments.verify(ref, planParam)
      .then(data => { setPlan(data.plan); setStatus("success"); showToast(`Welcome to ${data.plan.charAt(0).toUpperCase()+data.plan.slice(1)}! 🎉`,"success"); localStorage.removeItem("cvcraft_pending_plan"); })
      .catch(e => { setStatus("failed"); showToast(e.message||"Verification failed","error"); });
  }, []);

  return (
    <div className="callback-wrap">
      <div className="callback-box">
        {status === "verifying" && <>
          <Spinner lg/>
          <div className="callback-title" style={{marginTop:24}}>Verifying payment...</div>
          <div className="callback-desc">Please wait while we confirm your payment with Paystack.</div>
        </>}
        {status === "success" && <>
          <span className="callback-icon">🎉</span>
          <div className="callback-title">Payment Successful!</div>
          <div className="callback-desc">Your account has been upgraded to <strong>{plan?.charAt(0).toUpperCase()+plan?.slice(1)}</strong>. All features are now unlocked.</div>
          <button className="btn btn-primary btn-lg" onClick={()=>onNav("dashboard")}>Go to Dashboard →</button>
        </>}
        {status === "failed" && <>
          <span className="callback-icon">❌</span>
          <div className="callback-title">Payment Failed</div>
          <div className="callback-desc">Something went wrong with your payment. No money was charged. Please try again.</div>
          <div style={{display:"flex",gap:12,justifyContent:"center"}}>
            <button className="btn btn-secondary btn-lg" onClick={()=>onNav("dashboard")}>Dashboard</button>
            <button className="btn btn-primary btn-lg" onClick={()=>onNav("pricing")}>Try Again</button>
          </div>
        </>}
      </div>
    </div>
  );
}

// ── PRICING PAGE ──────────────────────────────────────────────
function PricingPage({ user, onNav, showToast }) {
  const [payModal, setPayModal] = useState(null);
  return (
    <div style={{padding:"64px 24px 80px"}}>
      <div style={{textAlign:"center",marginBottom:48}}>
        <div className="section-label">Pricing</div>
        <h2 className="section-title">Simple, Honest Pricing</h2>
        <p className="section-sub">No 4-week billing tricks. No hidden fees. Clear NGN pricing.</p>
      </div>
      <div className="pricing-grid">
        {PLANS.map(p=>(
          <div key={p.id} className={`pricing-card ${p.featured?"featured":""}`}>
            {p.featured && <div className="pricing-badge">MOST POPULAR</div>}
            <div className="pricing-name">{p.name}</div>
            <div className="pricing-price">{p.price}<span>{p.period}</span></div>
            <div className="pricing-desc">{p.desc}</div>
            <ul className="pricing-features">
              {p.features.map((f,i)=><li key={i}><span style={{color:f.y?"var(--success)":"var(--muted-2)",fontSize:15}}>{f.y?"✓":"✗"}</span><span style={{color:f.y?"var(--ink-2)":"var(--muted-2)"}}>{f.t}</span></li>)}
            </ul>
            {p.amount===0
              ? <button className="btn btn-secondary btn-full" onClick={()=>user?onNav("dashboard"):onNav("register")}>Get Started Free</button>
              : <button className="btn btn-primary btn-full" onClick={()=>user?setPayModal(p):onNav("register")}>{p.id==="lifetime"?"Get Lifetime Access":` Start Pro — ${p.price}`}</button>}
          </div>
        ))}
      </div>
      <p style={{textAlign:"center",color:"var(--muted)",fontSize:13,marginTop:32}}>Payments secured by <strong>Paystack</strong> 🔒 · NGN pricing · Cancel Pro anytime</p>
      {payModal && <PaystackModal plan={payModal} defaultEmail={user?.email} onClose={()=>setPayModal(null)} onSuccess={()=>{}} showToast={showToast}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  // Detect payment callback
  const isCallback = window.location.search.includes("reference=") || window.location.search.includes("trxref=");
  const [page, setPage] = useState(isCallback ? "callback" : "landing");
  const [user, setUser] = useState(null);
  const [plan, setPlan] = useState("free");
  const [builderResumeId, setBuilderResumeId] = useState(null);
  const [openImport, setOpenImport] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type="default") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Restore session on mount
  useEffect(() => {
    if (_token) {
      api.auth.me()
        .then(u => {
          setUser(u); setPlan(u.plan||"free");
          if (page==="landing"||page==="login"||page==="register") setPage("dashboard");
        })
        .catch(() => { setToken(null); });
    }
  }, []);

  const handleLogin = u => { setUser(u); setPlan(u.plan||"free"); setPage("dashboard"); };
  const handleLogout = () => { api.auth.logout(); setUser(null); setPlan("free"); setPage("landing"); };

  const openBuilder = (id, mode) => {
    setBuilderResumeId(id||null);
    if (mode==="import") setOpenImport(true);
    setPage("builder");
  };

  const nav = p => {
    if ((p==="dashboard"||p==="builder") && !user) { setPage("login"); return; }
    setPage(p);
  };

  return (
    <>
      <style>{CSS}</style>

      {/* NAV */}
      <nav className="nav">
        <div className="nav-inner">
          <div className="logo" onClick={()=>nav(user?"dashboard":"landing")}>CV<span>Craft</span></div>
          <div className="nav-right">
            {!user && <>
              <button className="nav-link" onClick={()=>nav("landing")}>Home</button>
              <button className="nav-link" onClick={()=>nav("pricing")}>Pricing</button>
              <button className="nav-link" onClick={()=>nav("login")}>Sign In</button>
              <button className="btn btn-primary btn-sm" onClick={()=>nav("register")}>Get Started Free</button>
            </>}
            {user && <>
              <button className={`nav-link ${page==="dashboard"?"active":""}`} onClick={()=>nav("dashboard")}>Dashboard</button>
              <button className={`nav-link ${page==="builder"?"active":""}`} onClick={()=>openBuilder(null)}>New Resume</button>
              <button className="nav-link" onClick={()=>nav("pricing")}>Pricing</button>
              <span className="plan-chip">{plan.charAt(0).toUpperCase()+plan.slice(1)}</span>
              <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Sign Out</button>
            </>}
          </div>
        </div>
      </nav>

      {/* PAGES */}
      {page==="landing"   && <LandingPage onNav={nav}/>}
      {page==="login"     && <AuthPage mode="login" onNav={nav} onLogin={handleLogin} showToast={showToast}/>}
      {page==="register"  && <AuthPage mode="register" onNav={nav} onLogin={handleLogin} showToast={showToast}/>}
      {page==="dashboard" && <DashboardPage user={user} plan={plan} onNav={nav} onOpenBuilder={openBuilder} showToast={showToast}/>}
      {page==="builder"   && <BuilderPage user={user} plan={plan} resumeId={builderResumeId} onNav={nav} showToast={showToast}/>}
      {page==="callback"  && <PaymentCallbackPage onNav={nav} showToast={showToast}/>}
      {page==="pricing"   && <PricingPage user={user} onNav={nav} showToast={showToast}/>}

      {/* TOAST */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
