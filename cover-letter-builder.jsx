import { useState, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   CVCraft — Cover Letter Builder
   • 5 tone styles  • AI generation via Claude API
   • Live A4 preview  • PDF/DOCX export
   • Pro/Lifetime gated
   ═══════════════════════════════════════════════════════════════ */

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Lora:ital,wght@0,400;0,600;0,700;1,400;1,600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');`;

const CSS = `
${FONTS}
.cl-wrap{display:grid;grid-template-columns:400px 1fr;min-height:calc(100vh - 64px);font-family:'DM Sans',sans-serif}
.cl-sidebar{background:#fff;border-right:1px solid #e2e2ee;overflow-y:auto;max-height:calc(100vh - 64px);position:sticky;top:64px}
.cl-preview{background:#c8c8d8;padding:32px;display:flex;flex-direction:column;align-items:center;gap:20px;overflow-y:auto}
.cl-sh{padding:22px 24px 18px;border-bottom:1px solid #e2e2ee;background:#fff;position:sticky;top:0;z-index:10}
.cl-sh h2{font-family:'Syne',sans-serif;font-weight:800;font-size:17px;color:#0a0a0f;letter-spacing:-.3px}
.cl-sh p{font-size:13px;color:#6b6b85;margin-top:3px}
.cl-sb{padding:20px 24px}
.cl-section{margin-bottom:24px}
.cl-section-title{font-family:'Syne',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#4f46e5;margin-bottom:12px}
.cl-field{margin-bottom:14px}
.cl-field label{display:block;font-size:13px;font-weight:600;color:#2e2e42;margin-bottom:5px}
.cl-field input,.cl-field textarea,.cl-field select{width:100%;padding:10px 14px;border:1.5px solid #e2e2ee;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:14px;color:#0a0a0f;background:#fff;outline:none;transition:.2s}
.cl-field input:focus,.cl-field textarea:focus,.cl-field select:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.1)}
.cl-field textarea{resize:vertical;min-height:80px;line-height:1.5}
.tone-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:4px}
.tone-card{border:2px solid #e2e2ee;border-radius:10px;padding:12px 8px;cursor:pointer;transition:.2s;text-align:center}
.tone-card.active{border-color:#4f46e5;background:#eef2ff}
.tone-card:hover{border-color:#4f46e5}
.tone-icon{font-size:20px;margin-bottom:4px}
.tone-name{font-size:12px;font-weight:700;color:#0a0a0f}
.tone-desc{font-size:10px;color:#6b6b85;margin-top:2px;line-height:1.3}
.ai-gen-panel{background:linear-gradient(135deg,#eef2ff,#f5f3ff);border:1.5px solid #c7d2fe;border-radius:12px;padding:18px;margin-bottom:16px}
.ai-gen-header{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.ai-badge{background:#4f46e5;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;letter-spacing:.5px}
.ai-gen-panel h3{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#4f46e5}
.spinner-sm{width:16px;height:16px;border:2px solid #c7d2fe;border-top-color:#4f46e5;border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;border:none;transition:.2s;white-space:nowrap}
.btn-primary{background:#4f46e5;color:#fff;box-shadow:0 2px 8px rgba(79,70,229,.3)}
.btn-primary:hover{background:#4338ca;transform:translateY(-1px)}
.btn-secondary{background:#fff;color:#0a0a0f;border:1.5px solid #e2e2ee}
.btn-secondary:hover{border-color:#4f46e5;color:#4f46e5}
.btn-sm{padding:7px 14px;font-size:13px}
.btn-full{width:100%;justify-content:center}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.cl-footer{padding:16px 24px;border-top:1px solid #e2e2ee;display:flex;gap:10px}
.preview-toolbar{display:flex;gap:10px;align-items:center;justify-content:space-between;background:#fff;padding:12px 20px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.06);align-self:stretch}
.char-count{font-size:12px;color:#9999b3;text-align:right;margin-top:4px}
.gate-overlay{background:linear-gradient(135deg,#0f0f1a,#1c1c38);border-radius:16px;padding:40px 32px;text-align:center;color:#fff;max-width:440px;margin:auto}
.gate-icon{font-size:48px;margin-bottom:16px}
.gate-title{font-family:'Syne',sans-serif;font-size:24px;font-weight:800;margin-bottom:8px;letter-spacing:-.5px}
.gate-desc{font-size:14px;color:#a5b4fc;line-height:1.65;margin-bottom:28px}

/* ── LETTER SHEET ── */
.letter-sheet{width:794px;min-height:1123px;background:#fff;box-shadow:0 4px 32px rgba(0,0,0,.18);padding:72px 80px;font-size:13.5px;line-height:1.8;color:#222;position:relative}

/* Professional */
.ls-professional{font-family:'DM Sans',sans-serif}
.ls-professional .ls-head{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:2px solid #0a0a0f;margin-bottom:32px}
.ls-professional .ls-sender{font-size:13px;color:#333}
.ls-professional .ls-name{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:#0a0a0f;letter-spacing:-.3px;margin-bottom:4px}
.ls-professional .ls-date{font-size:12px;color:#888;text-align:right;margin-top:4px}
.ls-professional .ls-contact-line{font-size:12px;color:#666;margin-top:2px}
.ls-professional .ls-recipient{margin-bottom:28px;font-size:13px;color:#333;line-height:1.7}
.ls-professional .ls-subject{font-weight:700;font-size:14px;color:#0a0a0f;margin-bottom:24px}
.ls-professional .ls-body p{margin-bottom:16px;color:#2a2a3a}
.ls-professional .ls-closing{margin-top:36px}
.ls-professional .ls-sig{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#0a0a0f;margin-top:32px}

/* Executive */
.ls-executive{font-family:'Lora',Georgia,serif}
.ls-executive .ls-head{text-align:center;padding-bottom:24px;border-bottom:1px solid #1a1a2e;margin-bottom:32px}
.ls-executive .ls-name{font-size:26px;font-weight:700;color:#1a1a2e;letter-spacing:.3px}
.ls-executive .ls-contact-line{font-family:'DM Sans',sans-serif;font-size:12px;color:#5c5c7a;margin-top:6px}
.ls-executive .ls-date{font-family:'DM Sans',sans-serif;font-size:12px;color:#888;margin-top:16px}
.ls-executive .ls-recipient{font-family:'DM Sans',sans-serif;font-size:13px;color:#333;margin:24px 0;line-height:1.7}
.ls-executive .ls-subject{font-weight:700;font-size:14px;font-style:italic;color:#1a1a2e;margin-bottom:24px}
.ls-executive .ls-body p{margin-bottom:18px;color:#2a2a3a}
.ls-executive .ls-closing{margin-top:40px}
.ls-executive .ls-sig{font-size:18px;font-weight:700;color:#1a1a2e;margin-top:36px}

/* Conversational */
.ls-conversational{font-family:'IBM Plex Sans',sans-serif}
.ls-conversational .ls-head{margin-bottom:28px}
.ls-conversational .ls-name{font-family:'Syne',sans-serif;font-size:18px;font-weight:700;color:#111;letter-spacing:-.3px}
.ls-conversational .ls-contact-line{font-size:12px;color:#888;margin-top:3px}
.ls-conversational .ls-date{font-size:12px;color:#bbb;margin-top:12px}
.ls-conversational .ls-recipient{font-size:13px;color:#555;margin:20px 0;line-height:1.6;padding-left:12px;border-left:3px solid #e2e2ee}
.ls-conversational .ls-subject{font-weight:600;font-size:14px;color:#4f46e5;margin-bottom:20px}
.ls-conversational .ls-body p{margin-bottom:16px;color:#333;font-weight:300}
.ls-conversational .ls-closing{margin-top:32px}
.ls-conversational .ls-sig{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#111;margin-top:24px}

/* Creative */
.ls-creative{font-family:'DM Sans',sans-serif}
.ls-creative .ls-head-bar{background:#0f0f1a;margin:-72px -80px 0;padding:36px 80px 28px;margin-bottom:36px}
.ls-creative .ls-name{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#fff;letter-spacing:-.5px}
.ls-creative .ls-contact-line{font-size:12px;color:#a5b4fc;margin-top:4px}
.ls-creative .ls-date{font-size:12px;color:#888;margin-top:20px}
.ls-creative .ls-recipient{font-size:13px;color:#444;margin-bottom:24px;line-height:1.7}
.ls-creative .ls-subject{font-family:'Syne',sans-serif;font-weight:800;font-size:16px;color:#4f46e5;margin-bottom:20px;letter-spacing:-.3px}
.ls-creative .ls-body p{margin-bottom:16px;color:#2a2a3a}
.ls-creative .ls-closing{margin-top:36px}
.ls-creative .ls-sig{font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:#0f0f1a;margin-top:28px}

/* Concise */
.ls-concise{font-family:'IBM Plex Sans',sans-serif}
.ls-concise .ls-head{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:36px;padding-bottom:24px;border-bottom:1px solid #eee}
.ls-concise .ls-name{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:#111;letter-spacing:-.5px}
.ls-concise .ls-contact-line{font-size:11px;color:#888;margin-top:3px}
.ls-concise .ls-date{font-size:11px;color:#bbb;text-align:right;margin-top:4px}
.ls-concise .ls-recipient{font-size:12px;color:#555;line-height:1.6;text-align:right}
.ls-concise .ls-subject{font-size:13px;font-weight:700;color:#111;margin-bottom:24px;padding:10px 14px;background:#f7f7fc;border-left:3px solid #4f46e5;border-radius:0 6px 6px 0}
.ls-concise .ls-body p{margin-bottom:14px;color:#333;font-size:13px;line-height:1.7;font-weight:300}
.ls-concise .ls-closing{margin-top:32px}
.ls-concise .ls-sig{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:#111;margin-top:24px}
`;

const TONES = [
  { id:"professional", icon:"👔", name:"Professional",    desc:"Formal, structured, traditional" },
  { id:"executive",    icon:"🎯", name:"Executive",       desc:"Authoritative, confident, senior" },
  { id:"conversational",icon:"💬",name:"Conversational",  desc:"Warm, natural, approachable" },
  { id:"creative",     icon:"✨", name:"Creative",        desc:"Bold, distinctive, memorable" },
  { id:"concise",      icon:"⚡", name:"Concise",         desc:"Brief, direct, high-impact" },
];

async function callClaude(prompt, system) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1200,
      system: system || "You are an expert career coach and cover letter writer.",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const d = await r.json();
  return d.content?.map(b => b.text || "").join("") || "";
}

// ── LETTER PREVIEW ────────────────────────────────────────────
function LetterPreview({ data }) {
  const { sender, jobDetails, tone, content } = data;
  const today = new Date().toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" });
  const cls = `letter-sheet ls-${tone}`;

  const Body = () => content
    ? content.split("\n\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)
    : <p style={{ color: "#aaa", fontStyle: "italic" }}>Your cover letter will appear here after generation...</p>;

  if (tone === "creative") return (
    <div className={cls}>
      <div className="ls-head-bar">
        <div className="ls-name">{sender.fullName || "Your Name"}</div>
        <div className="ls-contact-line">{[sender.email, sender.phone, sender.location].filter(Boolean).join("  ·  ")}</div>
      </div>
      <div className="ls-date">{today}</div>
      <div className="ls-recipient" style={{ marginTop: 20 }}>
        {jobDetails.hiringManager && <div><strong>{jobDetails.hiringManager}</strong></div>}
        {jobDetails.company && <div>{jobDetails.company}</div>}
      </div>
      <div className="ls-subject">Re: {jobDetails.jobTitle || "Open Position"}{jobDetails.company ? ` at ${jobDetails.company}` : ""}</div>
      <div className="ls-body"><Body /></div>
      <div className="ls-closing">
        <div>Sincerely,</div>
        <div className="ls-sig">{sender.fullName || "Your Name"}</div>
      </div>
    </div>
  );

  if (tone === "concise") return (
    <div className={cls}>
      <div className="ls-head">
        <div>
          <div className="ls-name">{sender.fullName || "Your Name"}</div>
          <div className="ls-contact-line">{[sender.email, sender.phone].filter(Boolean).join("  ·  ")}</div>
        </div>
        <div>
          <div className="ls-date" style={{ textAlign: "right" }}>{today}</div>
          <div className="ls-recipient">
            {jobDetails.hiringManager && <div><strong>{jobDetails.hiringManager}</strong></div>}
            {jobDetails.company && <div>{jobDetails.company}</div>}
          </div>
        </div>
      </div>
      <div className="ls-subject">Application: {jobDetails.jobTitle || "Position"}{jobDetails.company ? ` · ${jobDetails.company}` : ""}</div>
      <div className="ls-body"><Body /></div>
      <div className="ls-closing">
        <div>Best regards,</div>
        <div className="ls-sig">{sender.fullName || "Your Name"}</div>
      </div>
    </div>
  );

  if (tone === "executive") return (
    <div className={cls}>
      <div className="ls-head">
        <div className="ls-name">{sender.fullName || "Your Name"}</div>
        <div className="ls-contact-line">{[sender.email, sender.phone, sender.location].filter(Boolean).join("  ·  ")}</div>
        <div className="ls-date">{today}</div>
      </div>
      <div className="ls-recipient">
        {jobDetails.hiringManager && <div><strong>{jobDetails.hiringManager}</strong></div>}
        {jobDetails.company && <div>{jobDetails.company}</div>}
      </div>
      <div className="ls-subject">RE: {jobDetails.jobTitle || "Executive Position"}</div>
      <div className="ls-body"><Body /></div>
      <div className="ls-closing">
        <div>With respect,</div>
        <div className="ls-sig">{sender.fullName || "Your Name"}</div>
      </div>
    </div>
  );

  // Professional + Conversational
  return (
    <div className={cls}>
      <div className="ls-head">
        <div>
          <div className="ls-name">{sender.fullName || "Your Name"}</div>
          <div className="ls-contact-line">{[sender.email, sender.phone, sender.location].filter(Boolean).join("  ·  ")}</div>
        </div>
        <div className="ls-date">{today}</div>
      </div>
      <div className="ls-recipient">
        {jobDetails.hiringManager && <div><strong>{jobDetails.hiringManager}</strong></div>}
        {jobDetails.company && <div>{jobDetails.company}</div>}
        <div style={{ marginTop: 16 }}>Dear {jobDetails.hiringManager ? jobDetails.hiringManager.split(" ")[1] || jobDetails.hiringManager : "Hiring Manager"},</div>
      </div>
      <div className="ls-subject">RE: Application for {jobDetails.jobTitle || "Open Position"}</div>
      <div className="ls-body"><Body /></div>
      <div className="ls-closing">
        <div>{tone === "conversational" ? "Warmly," : "Sincerely,"}</div>
        <div className="ls-sig">{sender.fullName || "Your Name"}</div>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────
export default function CoverLetterBuilder({ user, plan, resumeData, onUpgrade }) {
  const [tone, setTone] = useState("professional");
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [sender, setSender] = useState({
    fullName: resumeData?.personal_info?.fullName || "",
    email:    resumeData?.personal_info?.email    || "",
    phone:    resumeData?.personal_info?.phone    || "",
    location: resumeData?.personal_info?.location || "",
  });

  const [jobDetails, setJobDetails] = useState({
    jobTitle:      "",
    company:       "",
    hiringManager: "",
    jobDescription:"",
  });

  const [content, setContent] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "default") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };
  const upSender = (f, v) => setSender(s => ({ ...s, [f]: v }));
  const upJob = (f, v) => setJobDetails(j => ({ ...j, [f]: v }));

  const generate = async () => {
    if (!jobDetails.jobTitle) { showToast("Enter a job title first", "warning"); return; }
    setGenerating(true);

    const expList = resumeData?.experience?.slice(0, 4)
      .map(e => `${e.jobTitle} at ${e.company} — ${(e.bullets || []).slice(0, 2).join(". ")}`)
      .join("\n") || "";
    const skillList = resumeData?.skills?.join(", ") || "";

    const toneGuides = {
      professional:    "formal, structured, third-person professional tone. Use traditional business letter conventions.",
      executive:       "authoritative, confident, senior-level tone. Emphasise leadership and strategic impact.",
      conversational:  "warm, genuine, approachable tone. First-person, natural, like talking to a person.",
      creative:        "bold, memorable, distinctive tone. Show personality. Avoid clichés. Make it unforgettable.",
      concise:         "direct, punchy, minimal. Max 3 short paragraphs. Every sentence must earn its place.",
    };

    const prompt = `Write a compelling cover letter in ${toneGuides[tone]}

Candidate:
Name: ${sender.fullName || "Candidate"}
Role applying for: ${jobDetails.jobTitle}${jobDetails.company ? ` at ${jobDetails.company}` : ""}
${jobDetails.hiringManager ? `Hiring Manager: ${jobDetails.hiringManager}` : ""}

Resume summary:
${resumeData?.personal_info?.summary || ""}

Key experience:
${expList}

Skills: ${skillList}

${jobDetails.jobDescription ? `Job description (tailor to this):\n${jobDetails.jobDescription.slice(0, 800)}` : ""}

Rules:
- Do NOT include salutation/greeting line (e.g. "Dear...") — it's handled separately
- Do NOT include the closing/signature — handled separately  
- Write ONLY the body paragraphs (opening hook, middle, closing paragraph)
- Separate paragraphs with a blank line
- Be specific, not generic. Reference actual experience and skills.
- ${tone === "concise" ? "Maximum 3 short paragraphs, 250 words total" : "3–4 paragraphs, 300–400 words"}

Return only the body text, no labels.`;

    try {
      const text = await callClaude(prompt);
      setContent(text.trim());
      setWordCount(text.trim().split(/\s+/).length);
      showToast("Letter generated! ✓", "success");
    } catch (e) {
      showToast("Generation failed — check API connection", "error");
    }
    setGenerating(false);
  };

  const regenerateSection = async (section) => {
    if (!content) { showToast("Generate the full letter first", "warning"); return; }
    const paragraphs = content.split("\n\n").filter(Boolean);
    const idx = section === "opening" ? 0 : section === "closing" ? paragraphs.length - 1 : 1;
    setGenerating(true);
    try {
      const sectionText = await callClaude(
        `Rewrite only this ${section} paragraph of a cover letter for ${jobDetails.jobTitle} at ${jobDetails.company}. Make it stronger and more specific.\n\nCurrent paragraph:\n${paragraphs[idx]}\n\nReturn only the new paragraph text.`
      );
      const newParagraphs = [...paragraphs];
      newParagraphs[idx] = sectionText.trim();
      const newContent = newParagraphs.join("\n\n");
      setContent(newContent);
      setWordCount(newContent.split(/\s+/).length);
      showToast(`${section} improved ✓`, "success");
    } catch (e) { showToast("Failed", "error"); }
    setGenerating(false);
  };

  const exportPDF = async () => {
    showToast("Connect /export/cover-letter to your FastAPI backend for PDF generation", "default");
  };

  const copyText = () => {
    const full = `${sender.fullName}\n${[sender.email, sender.phone, sender.location].filter(Boolean).join(" · ")}\n\n${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}\n\n${jobDetails.hiringManager ? `${jobDetails.hiringManager}\n` : ""}${jobDetails.company || ""}\n\nDear ${jobDetails.hiringManager ? jobDetails.hiringManager.split(" ").pop() : "Hiring Manager"},\n\n${content}\n\nSincerely,\n${sender.fullName}`;
    navigator.clipboard.writeText(full);
    showToast("Copied to clipboard ✓", "success");
  };

  // Plan gate
  if (plan === "free") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 64px)", background: "#d0d0e0", padding: 24 }}>
        <div className="gate-overlay">
          <div className="gate-icon">✉️</div>
          <div className="gate-title">Cover Letter Builder</div>
          <div className="gate-desc">AI-powered cover letters tailored to every job posting. Matches your resume automatically. Available on Pro and Lifetime plans.</div>
          <button className="btn btn-primary btn-lg" style={{ margin: "0 auto" }} onClick={onUpgrade}>
            Upgrade to Pro — ₦4,500/mo →
          </button>
          <div style={{ marginTop: 16, fontSize: 13, color: "#6b7280" }}>or get Lifetime access for ₦19,900</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="cl-wrap">
        {/* ── SIDEBAR ── */}
        <aside className="cl-sidebar">
          <div className="cl-sh">
            <h2>Cover Letter Builder</h2>
            <p>AI-powered · Matches your resume · 5 styles</p>
          </div>

          <div className="cl-sb">
            {/* AI Generate */}
            <div className="ai-gen-panel">
              <div className="ai-gen-header">
                <span className="ai-badge">AI</span>
                <h3>Generate with Claude AI</h3>
              </div>
              <p style={{ fontSize: 13, color: "#4338ca", marginBottom: 12, lineHeight: 1.5 }}>Fill in the job details below, then let AI write a tailored letter in your chosen tone.</p>
              <button className="btn btn-primary btn-full" onClick={generate} disabled={generating}>
                {generating ? <><span className="spinner-sm" />Writing...</> : "✨ Generate Letter"}
              </button>
              {content && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => regenerateSection("opening")} disabled={generating}>↺ Opening</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => regenerateSection("closing")} disabled={generating}>↺ Closing</button>
                  <button className="btn btn-secondary btn-sm" onClick={generate} disabled={generating}>↺ Full</button>
                </div>
              )}
            </div>

            {/* Tone */}
            <div className="cl-section">
              <div className="cl-section-title">Tone & Style</div>
              <div className="tone-grid">
                {TONES.map(t => (
                  <div key={t.id} className={`tone-card ${tone === t.id ? "active" : ""}`} onClick={() => setTone(t.id)}>
                    <div className="tone-icon">{t.icon}</div>
                    <div className="tone-name">{t.name}</div>
                    <div className="tone-desc">{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Job Details */}
            <div className="cl-section">
              <div className="cl-section-title">Job Details</div>
              <div className="cl-field"><label>Job Title *</label><input value={jobDetails.jobTitle} onChange={e => upJob("jobTitle", e.target.value)} placeholder="Senior Software Engineer" /></div>
              <div className="cl-field"><label>Company</label><input value={jobDetails.company} onChange={e => upJob("company", e.target.value)} placeholder="Acme Corp" /></div>
              <div className="cl-field"><label>Hiring Manager (optional)</label><input value={jobDetails.hiringManager} onChange={e => upJob("hiringManager", e.target.value)} placeholder="Mr. James Obi" /></div>
              <div className="cl-field">
                <label>Job Description (for AI tailoring)</label>
                <textarea value={jobDetails.jobDescription} onChange={e => upJob("jobDescription", e.target.value)} placeholder="Paste the job description here for a more tailored letter..." rows={5} />
              </div>
            </div>

            {/* Sender Info */}
            <div className="cl-section">
              <div className="cl-section-title">Your Details</div>
              {[["fullName","Full Name","Kamaldeen Adesanya"],["email","Email","you@example.com"],["phone","Phone","+234 800 000 0000"],["location","Location","Lagos, Nigeria"]].map(([f,l,ph]) => (
                <div className="cl-field" key={f}><label>{l}</label><input value={sender[f]} onChange={e => upSender(f, e.target.value)} placeholder={ph} /></div>
              ))}
            </div>

            {/* Editable content */}
            {content && (
              <div className="cl-section">
                <div className="cl-section-title">Edit Letter Body</div>
                <div className="cl-field">
                  <textarea value={content} onChange={e => { setContent(e.target.value); setWordCount(e.target.value.split(/\s+/).filter(Boolean).length); }} rows={14} />
                  <div className="char-count">{wordCount} words</div>
                </div>
              </div>
            )}
          </div>

          <div className="cl-footer">
            <button className="btn btn-secondary btn-sm" onClick={copyText} disabled={!content}>📋 Copy</button>
            <button className="btn btn-secondary btn-sm" onClick={exportPDF} disabled={!content}>⬇ PDF</button>
            <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={generate} disabled={generating}>
              {generating ? "Writing..." : "✨ Regenerate"}
            </button>
          </div>
        </aside>

        {/* ── PREVIEW ── */}
        <main className="cl-preview">
          <div className="preview-toolbar">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14 }}>Live Preview</span>
              <span style={{ fontSize: 12, padding: "2px 8px", background: "#eef2ff", color: "#4f46e5", borderRadius: 20, fontWeight: 600 }}>{TONES.find(t => t.id === tone)?.name}</span>
              {wordCount > 0 && <span style={{ fontSize: 12, color: "#6b6b85" }}>{wordCount} words</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={copyText} disabled={!content}>📋 Copy Text</button>
              <button className="btn btn-primary btn-sm" onClick={exportPDF} disabled={!content}>⬇ Export PDF</button>
            </div>
          </div>
          <div style={{ transform: "scale(0.72)", transformOrigin: "top center", marginBottom: -320 }}>
            <LetterPreview data={{ sender, jobDetails, tone, content }} />
          </div>
        </main>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: toast.type === "success" ? "#059669" : toast.type === "error" ? "#dc2626" : toast.type === "warning" ? "#d97706" : "#0a0a0f", color: "#fff", padding: "14px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, zIndex: 500, boxShadow: "0 8px 32px rgba(0,0,0,.2)", animation: "slideUp .3s ease", maxWidth: 320 }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
