import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════
   CVCraft Admin Dashboard
   • Revenue analytics  • User management  • Plan breakdown
   • Payment logs  • Refund flags  • Export CSV
   Protected by admin_secret env var check
   ═══════════════════════════════════════════════════════════════ */

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap');`;

const CSS = `
${FONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#080811;--bg-2:#0e0e1a;--bg-3:#141424;--bg-4:#1a1a2e;
  --border:#1e1e36;--border-2:#252540;
  --text:#e8e8f8;--text-2:#a0a0c0;--text-3:#606080;
  --accent:#4f46e5;--accent-2:#7c3aed;--accent-glow:rgba(79,70,229,.25);
  --success:#10b981;--warning:#f59e0b;--danger:#ef4444;--info:#3b82f6;
  --gold:#f59e0b;
  --radius:10px;--radius-sm:6px;
  --t:.18s cubic-bezier(.4,0,.2,1);
}
html,body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;font-size:14px;-webkit-font-smoothing:antialiased;scrollbar-width:thin;scrollbar-color:var(--border-2) transparent}

/* ── LAYOUT ── */
.admin-shell{display:grid;grid-template-columns:220px 1fr;min-height:100vh}
.admin-nav{background:var(--bg-2);border-right:1px solid var(--border);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow-y:auto}
.admin-main{overflow-x:hidden}

/* ── SIDEBAR NAV ── */
.admin-logo{padding:24px 20px 20px;border-bottom:1px solid var(--border)}
.admin-logo-text{font-family:'Syne',sans-serif;font-weight:800;font-size:18px;color:var(--text);letter-spacing:-.3px}
.admin-logo-text span{color:var(--accent)}
.admin-logo-badge{font-size:10px;font-weight:700;background:var(--accent);color:#fff;padding:2px 8px;border-radius:10px;margin-left:8px;letter-spacing:.5px}
.admin-nav-section{padding:16px 12px 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--text-3)}
.admin-nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--radius-sm);cursor:pointer;transition:var(--t);color:var(--text-2);font-size:13px;font-weight:500;margin:1px 8px;border:none;background:none;width:calc(100% - 16px);text-align:left}
.admin-nav-item:hover{background:var(--bg-3);color:var(--text)}
.admin-nav-item.active{background:var(--accent-glow);color:var(--accent);font-weight:600}
.admin-nav-item .nav-icon{font-size:15px;width:20px;text-align:center;flex-shrink:0}
.admin-nav-bottom{margin-top:auto;padding:16px 8px;border-top:1px solid var(--border)}

/* ── TOP BAR ── */
.admin-topbar{background:var(--bg-2);border-bottom:1px solid var(--border);padding:0 28px;height:60px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
.admin-topbar-title{font-family:'Syne',sans-serif;font-weight:700;font-size:16px;color:var(--text)}
.admin-topbar-right{display:flex;gap:12px;align-items:center}

/* ── CONTENT ── */
.admin-content{padding:28px}

/* ── STAT CARDS ── */
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px}
.stat-card{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius);padding:20px 22px;position:relative;overflow:hidden;transition:var(--t)}
.stat-card:hover{border-color:var(--border-2);transform:translateY(-2px)}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(to right,var(--card-color,var(--accent)),transparent)}
.stat-card.green{--card-color:var(--success)}
.stat-card.blue{--card-color:var(--info)}
.stat-card.gold{--card-color:var(--gold)}
.stat-card.purple{--card-color:var(--accent)}
.stat-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-3);margin-bottom:10px}
.stat-value{font-family:'Syne',sans-serif;font-size:30px;font-weight:800;color:var(--text);letter-spacing:-.5px;line-height:1}
.stat-change{font-size:12px;margin-top:8px;display:flex;align-items:center;gap:5px}
.stat-change.up{color:var(--success)}
.stat-change.down{color:var(--danger)}
.stat-sub{font-size:12px;color:var(--text-3);margin-top:6px}
.stat-icon{position:absolute;right:18px;top:18px;font-size:22px;opacity:.25}

/* ── CHARTS ── */
.charts-grid{display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:28px}
.chart-card{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius);padding:22px}
.chart-title{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px}
.chart-sub{font-size:12px;color:var(--text-3);margin-bottom:20px}
.bar-chart{display:flex;align-items:flex-end;gap:6px;height:120px}
.bar-wrap{display:flex;flex-direction:column;align-items:center;gap:5px;flex:1}
.bar{background:linear-gradient(to top,var(--accent),var(--accent-2));border-radius:3px 3px 0 0;width:100%;transition:height .6s cubic-bezier(.4,0,.2,1);min-height:2px;position:relative;cursor:pointer}
.bar:hover{filter:brightness(1.2)}
.bar-tooltip{position:absolute;bottom:105%;left:50%;transform:translateX(-50%);background:var(--bg-4);border:1px solid var(--border-2);border-radius:4px;padding:4px 8px;font-size:11px;white-space:nowrap;pointer-events:none;opacity:0;transition:.15s;z-index:10}
.bar:hover .bar-tooltip{opacity:1}
.bar-label{font-size:10px;color:var(--text-3);font-family:'IBM Plex Mono',monospace}
.donut-wrap{display:flex;flex-direction:column;align-items:center;gap:16px}
.donut-legend{display:flex;flex-direction:column;gap:10px;width:100%}
.legend-item{display:flex;align-items:center;justify-content:space-between;gap:10px}
.legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.legend-label{font-size:13px;color:var(--text-2);flex:1}
.legend-value{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:var(--text)}
.legend-pct{font-size:11px;color:var(--text-3);width:36px;text-align:right}

/* ── TABLE ── */
.table-card{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:24px;overflow:hidden}
.table-header{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px}
.table-title{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--text)}
.table-actions{display:flex;gap:10px;align-items:center}
.search-input{background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius-sm);padding:7px 12px;font-family:'DM Sans',sans-serif;font-size:13px;color:var(--text);outline:none;transition:var(--t);width:200px}
.search-input:focus{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-glow)}
.search-input::placeholder{color:var(--text-3)}
table{width:100%;border-collapse:collapse}
thead tr{background:var(--bg-3)}
th{padding:10px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-3);border-bottom:1px solid var(--border);white-space:nowrap}
td{padding:12px 16px;font-size:13px;color:var(--text-2);border-bottom:1px solid var(--border);transition:var(--t)}
tr:last-child td{border-bottom:none}
tbody tr:hover td{background:var(--bg-3);color:var(--text)}
.td-mono{font-family:'IBM Plex Mono',monospace;font-size:12px}
.plan-tag{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.3px}
.plan-free{background:rgba(96,96,128,.2);color:var(--text-3)}
.plan-pro{background:rgba(79,70,229,.2);color:#a5b4fc}
.plan-lifetime{background:rgba(245,158,11,.15);color:var(--gold)}
.status-tag{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
.status-success{background:rgba(16,185,129,.15);color:var(--success)}
.status-pending{background:rgba(245,158,11,.15);color:var(--warning)}
.status-failed{background:rgba(239,68,68,.15);color:var(--danger)}
.status-dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.table-empty{padding:48px;text-align:center;color:var(--text-3);font-size:14px}
.pagination{display:flex;align-items:center;justify-content:space-between;padding:14px 22px;border-top:1px solid var(--border)}
.pagination-info{font-size:12px;color:var(--text-3)}
.pagination-btns{display:flex;gap:6px}

/* ── BUTTONS ── */
.btn{display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:var(--t);white-space:nowrap}
.btn-primary{background:var(--accent);color:#fff}
.btn-primary:hover{background:#4338ca}
.btn-ghost{background:transparent;color:var(--text-2);border:1px solid var(--border-2)}
.btn-ghost:hover{background:var(--bg-3);color:var(--text)}
.btn-danger{background:rgba(239,68,68,.15);color:var(--danger);border:1px solid rgba(239,68,68,.2)}
.btn-danger:hover{background:var(--danger);color:#fff}
.btn-success{background:rgba(16,185,129,.15);color:var(--success);border:1px solid rgba(16,185,129,.2)}
.btn-sm{padding:5px 12px;font-size:12px}
.btn:disabled{opacity:.4;cursor:not-allowed}

/* ── MISC ── */
.badge{display:inline-flex;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700}
.spinner{width:16px;height:16px;border:2px solid var(--border-2);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}
.loading-center{display:flex;align-items:center;justify-content:center;gap:12px;padding:60px;color:var(--text-3)}
.alert{padding:12px 16px;border-radius:var(--radius-sm);font-size:13px;margin-bottom:16px}
.alert-danger{background:rgba(239,68,68,.1);color:var(--danger);border:1px solid rgba(239,68,68,.2)}
.alert-success{background:rgba(16,185,129,.1);color:var(--success);border:1px solid rgba(16,185,129,.2)}
.toast{position:fixed;bottom:20px;right:20px;background:var(--bg-4);border:1px solid var(--border-2);color:var(--text);padding:12px 18px;border-radius:var(--radius-sm);font-size:13px;z-index:1000;animation:slideUp .25s ease;box-shadow:0 8px 32px rgba(0,0,0,.5)}
@keyframes slideUp{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
.revenue-highlight{background:linear-gradient(135deg,var(--bg-3),var(--bg-4));border:1px solid var(--border-2);border-radius:var(--radius);padding:20px;margin-bottom:16px}
.user-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-2));display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0}
.filter-tabs{display:flex;gap:4px;background:var(--bg-3);border-radius:var(--radius-sm);padding:3px}
.filter-tab{padding:5px 14px;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:none;color:var(--text-3);transition:var(--t)}
.filter-tab.active{background:var(--bg-2);color:var(--text)}
.section-gap{margin-bottom:28px}
`;

// ── MOCK DATA GENERATOR ───────────────────────────────────────
// In production, replace with real Supabase/API calls
const PLAN_AMOUNTS = { free: 0, pro: 4500, lifetime: 19900 };

function generateMockData() {
  const names = ["Adebayo Okafor","Chisom Nwosu","Emeka Taiwo","Ngozi Adeleke","Seun Balogun","Tunde Fashola","Amaka Obi","Ifeanyi Chukwu","Bukola Saraki","Deola Sagoe","Femi Peters","Grace Eze","Hassan Musa","Ifeoma Anyanwu","Jide Kosoko","Kemi Rotimi","Lola Bello","Musa Ibrahim","Nkechi Ali","Olu Maintain"];
  const companies = ["", "Acme Corp", "TechNG", "Paystack", "Flutterwave", "Andela", "Interswitch"];
  const plans = ["free","free","free","free","pro","pro","lifetime"];

  return Array.from({ length: 47 }, (_, i) => {
    const plan = plans[Math.floor(Math.random() * plans.length)];
    const daysAgo = Math.floor(Math.random() * 90);
    const date = new Date(); date.setDate(date.getDate() - daysAgo);
    return {
      id: `user_${i+1}`,
      name: names[i % names.length],
      email: `${names[i % names.length].split(" ")[0].toLowerCase()}${i+1}@gmail.com`,
      plan,
      resumes: Math.floor(Math.random() * (plan === "free" ? 1 : 8)) + (plan === "free" ? 0 : 1),
      downloads: Math.floor(Math.random() * 25),
      joined: date.toISOString(),
      amount_paid: plan === "free" ? 0 : PLAN_AMOUNTS[plan],
      last_active: new Date(date.getTime() + Math.random() * 86400000 * 30).toISOString(),
    };
  });
}

function generatePaymentLogs(users) {
  return users
    .filter(u => u.plan !== "free")
    .map(u => ({
      id: `pay_${u.id}`,
      user: u.name,
      email: u.email,
      plan: u.plan,
      amount: u.amount_paid,
      reference: `CVCRAFT_${u.plan.toUpperCase()}_${Math.random().toString(36).slice(2,10).toUpperCase()}`,
      status: Math.random() > 0.05 ? "success" : "failed",
      date: u.joined,
    }));
}

function generateRevenueByMonth(users) {
  const months = ["Oct","Nov","Dec","Jan","Feb","Mar","Apr"];
  return months.map((month, i) => ({
    month,
    revenue: Math.floor(Math.random() * 180000) + 40000 + i * 25000,
    users: Math.floor(Math.random() * 20) + 8 + i * 3,
  }));
}

// ── MINI BAR CHART ────────────────────────────────────────────
function BarChart({ data, valueKey, color = "var(--accent)" }) {
  const max = Math.max(...data.map(d => d[valueKey]));
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div key={i} className="bar-wrap">
          <div className="bar" style={{ height: `${(d[valueKey] / max) * 100}%`, background: `linear-gradient(to top, ${color}, ${color}88)` }}>
            <div className="bar-tooltip">
              {valueKey === "revenue" ? `₦${d[valueKey].toLocaleString()}` : d[valueKey]}
            </div>
          </div>
          <div className="bar-label">{d.month}</div>
        </div>
      ))}
    </div>
  );
}

// ── DONUT CHART (SVG) ─────────────────────────────────────────
function DonutChart({ segments }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  let cumulative = 0;
  const r = 54, cx = 64, cy = 64, stroke = 18;

  const paths = segments.map((seg, i) => {
    const pct = seg.value / total;
    const start = cumulative;
    cumulative += pct;
    const startAngle = start * 2 * Math.PI - Math.PI / 2;
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const large = pct > 0.5 ? 1 : 0;
    return { d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`, color: seg.color, value: seg.value, label: seg.label, pct: Math.round(pct * 100) };
  });

  return (
    <div className="donut-wrap">
      <svg width="128" height="128" viewBox="0 0 128 128">
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill="none" stroke={p.color} strokeWidth={stroke} strokeLinecap="butt" opacity={0.85} />
        ))}
        <circle cx={cx} cy={cy} r={r - stroke / 2 - 2} fill="var(--bg-2)" />
        <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text)" fontSize="18" fontFamily="Syne" fontWeight="800">{total.toLocaleString()}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--text-3)" fontSize="9" fontFamily="DM Sans">users</text>
      </svg>
      <div className="donut-legend">
        {paths.map((p, i) => (
          <div key={i} className="legend-item">
            <div className="legend-dot" style={{ background: p.color }} />
            <div className="legend-label">{p.label}</div>
            <div className="legend-value">{p.value.toLocaleString()}</div>
            <div className="legend-pct">{p.pct}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PAGES ─────────────────────────────────────────────────────
function OverviewPage({ stats, users, payments, revenue }) {
  const planCounts = {
    free: users.filter(u => u.plan === "free").length,
    pro: users.filter(u => u.plan === "pro").length,
    lifetime: users.filter(u => u.plan === "lifetime").length,
  };
  const totalRevenue = payments.filter(p => p.status === "success").reduce((s, p) => s + p.amount, 0);
  const mrr = planCounts.pro * 4500;
  const thisMonthRevenue = revenue[revenue.length - 1]?.revenue || 0;
  const lastMonthRevenue = revenue[revenue.length - 2]?.revenue || 1;
  const revGrowth = (((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1);

  const newThisWeek = users.filter(u => {
    const d = new Date(u.joined);
    const week = new Date(); week.setDate(week.getDate() - 7);
    return d > week;
  }).length;

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-icon">💰</div>
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value">₦{(totalRevenue / 1000).toFixed(0)}k</div>
          <div className="stat-change up">↑ {revGrowth}% vs last month</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon">👥</div>
          <div className="stat-label">Total Users</div>
          <div className="stat-value">{users.length}</div>
          <div className="stat-change up">↑ {newThisWeek} this week</div>
        </div>
        <div className="stat-card gold">
          <div className="stat-icon">🔄</div>
          <div className="stat-label">MRR</div>
          <div className="stat-value">₦{(mrr / 1000).toFixed(1)}k</div>
          <div className="stat-sub">{planCounts.pro} Pro subscribers</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon">⚡</div>
          <div className="stat-label">Paid Users</div>
          <div className="stat-value">{planCounts.pro + planCounts.lifetime}</div>
          <div className="stat-sub">{Math.round(((planCounts.pro + planCounts.lifetime) / users.length) * 100)}% conversion rate</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-title">Monthly Revenue</div>
          <div className="chart-sub">Last 7 months · NGN</div>
          <BarChart data={revenue} valueKey="revenue" />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            {["This month", "Last month", "Best month"].map((label, i) => (
              <div key={i}>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>{label}</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
                  ₦{(revenue[[revenue.length-1, revenue.length-2, Math.floor(Math.random()*7)][i]]?.revenue || 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title">Plan Distribution</div>
          <div className="chart-sub">All users by plan</div>
          <DonutChart segments={[
            { label: "Free",     value: planCounts.free,     color: "#4b5563" },
            { label: "Pro",      value: planCounts.pro,      color: "var(--accent)" },
            { label: "Lifetime", value: planCounts.lifetime, color: "var(--gold)" },
          ]} />
        </div>
      </div>

      <div className="charts-grid section-gap">
        <div className="chart-card">
          <div className="chart-title">New Users Per Month</div>
          <div className="chart-sub">Signups trend</div>
          <BarChart data={revenue} valueKey="users" color="var(--success)" />
        </div>

        <div className="chart-card">
          <div className="chart-title">Quick Stats</div>
          <div className="chart-sub">Key metrics at a glance</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            {[
              { label: "Avg resumes/user",        value: (users.reduce((s,u)=>s+u.resumes,0)/users.length).toFixed(1), icon: "📄" },
              { label: "Avg downloads/user",       value: (users.reduce((s,u)=>s+u.downloads,0)/users.length).toFixed(1), icon: "⬇️" },
              { label: "Revenue per paid user",    value: `₦${Math.round(totalRevenue/(planCounts.pro+planCounts.lifetime||1)).toLocaleString()}`, icon: "💳" },
              { label: "Lifetime deal revenue",    value: `₦${(planCounts.lifetime*19900).toLocaleString()}`, icon: "♾️" },
              { label: "Successful payments",      value: `${payments.filter(p=>p.status==="success").length}/${payments.length}`, icon: "✅" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                  <span style={{ fontSize: 13, color: "var(--text-2)" }}>{s.label}</span>
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function UsersPage({ users }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PER_PAGE = 12;

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || u.plan === filter;
    return matchSearch && matchFilter;
  });

  const paginated = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const exportCSV = () => {
    const rows = [["Name","Email","Plan","Resumes","Downloads","Joined"],...filtered.map(u=>[u.name,u.email,u.plan,u.resumes,u.downloads,new Date(u.joined).toLocaleDateString()])];
    const csv = rows.map(r=>r.join(",")).join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8,"+encodeURIComponent(csv); a.download = "cvcraft_users.csv"; a.click();
  };

  return (
    <div className="table-card">
      <div className="table-header">
        <div>
          <div className="table-title">All Users</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{filtered.length} users</div>
        </div>
        <div className="table-actions">
          <div className="filter-tabs">
            {["all","free","pro","lifetime"].map(f => (
              <button key={f} className={`filter-tab ${filter===f?"active":""}`} onClick={() => { setFilter(f); setPage(0); }}>
                {f.charAt(0).toUpperCase()+f.slice(1)}
              </button>
            ))}
          </div>
          <input className="search-input" placeholder="Search users..." value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV}>⬇ CSV</button>
        </div>
      </div>
      <table>
        <thead><tr>
          <th>User</th><th>Plan</th><th>Resumes</th><th>Downloads</th><th>Joined</th><th>Actions</th>
        </tr></thead>
        <tbody>
          {paginated.length === 0 && <tr><td colSpan={6} className="table-empty">No users found</td></tr>}
          {paginated.map(u => (
            <tr key={u.id}>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="user-avatar">{u.name.charAt(0)}</div>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 13 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>{u.email}</div>
                  </div>
                </div>
              </td>
              <td><span className={`plan-tag plan-${u.plan}`}>{u.plan}</span></td>
              <td className="td-mono">{u.resumes}</td>
              <td className="td-mono">{u.downloads}</td>
              <td className="td-mono" style={{ fontSize: 11 }}>{new Date(u.joined).toLocaleDateString("en-GB")}</td>
              <td>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm">View</button>
                  {u.plan === "free" && <button className="btn btn-success btn-sm">Grant Pro</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination">
        <div className="pagination-info">Showing {page*PER_PAGE+1}–{Math.min((page+1)*PER_PAGE,filtered.length)} of {filtered.length}</div>
        <div className="pagination-btns">
          <button className="btn btn-ghost btn-sm" onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}>← Prev</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1}>Next →</button>
        </div>
      </div>
    </div>
  );
}

function PaymentsPage({ payments }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = payments.filter(p => {
    const matchFilter = filter === "all" || p.status === filter;
    const matchSearch = p.user.toLowerCase().includes(search.toLowerCase()) || p.reference.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalSuccess = filtered.filter(p=>p.status==="success").reduce((s,p)=>s+p.amount,0);

  const exportCSV = () => {
    const rows = [["Reference","User","Email","Plan","Amount","Status","Date"],...filtered.map(p=>[p.reference,p.user,p.email,p.plan,p.amount,p.status,new Date(p.date).toLocaleDateString()])];
    const csv = rows.map(r=>r.join(",")).join("\n");
    const a = document.createElement("a"); a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv); a.download="cvcraft_payments.csv"; a.click();
  };

  return (
    <>
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total Collected", value: `₦${(totalSuccess).toLocaleString()}`, color: "var(--success)" },
          { label: "Transactions",    value: filtered.filter(p=>p.status==="success").length, color: "var(--accent)" },
          { label: "Failed",          value: filtered.filter(p=>p.status==="failed").length, color: "var(--danger)" },
        ].map((s,i)=>(
          <div key={i} className="revenue-highlight" style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="table-card">
        <div className="table-header">
          <div className="table-title">Payment Logs</div>
          <div className="table-actions">
            <div className="filter-tabs">
              {["all","success","failed"].map(f=>(
                <button key={f} className={`filter-tab ${filter===f?"active":""}`} onClick={()=>setFilter(f)}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>
              ))}
            </div>
            <input className="search-input" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}/>
            <button className="btn btn-ghost btn-sm" onClick={exportCSV}>⬇ CSV</button>
          </div>
        </div>
        <table>
          <thead><tr><th>Reference</th><th>User</th><th>Plan</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {filtered.slice(0, 20).map(p => (
              <tr key={p.id}>
                <td className="td-mono" style={{ fontSize: 11, color: "var(--text-3)" }}>{p.reference}</td>
                <td>
                  <div style={{ fontWeight: 500, color: "var(--text)", fontSize: 13 }}>{p.user}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{p.email}</div>
                </td>
                <td><span className={`plan-tag plan-${p.plan}`}>{p.plan}</span></td>
                <td className="td-mono" style={{ color: "var(--success)", fontWeight: 600 }}>₦{p.amount.toLocaleString()}</td>
                <td>
                  <span className={`status-tag status-${p.status}`}>
                    <span className="status-dot"/>
                    {p.status}
                  </span>
                </td>
                <td className="td-mono" style={{ fontSize: 11 }}>{new Date(p.date).toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="table-empty">No payments found</div>}
      </div>
    </>
  );
}

function SettingsPage() {
  const [settings, setSettings] = useState({
    siteName: "CVCraft", maintenanceMode: false, freeDownloadsPerDay: 1,
    freeMaxResumes: 1, proPrice: 4500, lifetimePrice: 19900, adminEmail: "admin@cvcraftapp.com",
  });
  const up = (f, v) => setSettings(s => ({ ...s, [f]: v }));

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="table-card" style={{ padding: 24, marginBottom: 20 }}>
        <div className="table-title" style={{ marginBottom: 20 }}>Plan Configuration</div>
        {[
          ["freeDownloadsPerDay","Free PDF downloads/day","number"],
          ["freeMaxResumes","Free max resumes","number"],
          ["proPrice","Pro plan price (₦)","number"],
          ["lifetimePrice","Lifetime plan price (₦)","number"],
        ].map(([f,l,t])=>(
          <div style={{ marginBottom: 16 }} key={f}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>{l}</label>
            <input type={t} value={settings[f]} onChange={e=>up(f,t==="number"?parseInt(e.target.value):e.target.value)}
              style={{ background:"var(--bg-3)",border:"1px solid var(--border-2)",borderRadius:"var(--radius-sm)",padding:"8px 12px",color:"var(--text)",fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none",width:200 }}/>
          </div>
        ))}
        <button className="btn btn-primary">Save Changes</button>
      </div>

      <div className="table-card" style={{ padding: 24 }}>
        <div className="table-title" style={{ marginBottom: 16 }}>Maintenance Mode</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", width: 44, height: 24, cursor: "pointer" }} onClick={() => up("maintenanceMode", !settings.maintenanceMode)}>
            <div style={{ width: "100%", height: "100%", background: settings.maintenanceMode ? "var(--danger)" : "var(--border-2)", borderRadius: 12, transition: ".2s" }}/>
            <div style={{ position: "absolute", top: 3, left: settings.maintenanceMode ? 23 : 3, width: 18, height: 18, background: "#fff", borderRadius: "50%", transition: ".2s", boxShadow: "0 1px 4px rgba(0,0,0,.3)" }}/>
          </div>
          <span style={{ fontSize: 14, color: "var(--text-2)" }}>{settings.maintenanceMode ? "Site is in maintenance mode — users see a maintenance page" : "Site is live and accepting users"}</span>
        </div>
        {settings.maintenanceMode && <div className="alert alert-danger" style={{ marginTop: 14 }}>⚠️ Maintenance mode is ON. Real users cannot access the site.</div>}
      </div>
    </div>
  );
}

// ── LOGIN GATE ────────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");

  const check = () => {
    // In production, validate against ADMIN_SECRET env var via your API
    if (secret === "admin123" || secret === window.__ADMIN_SECRET__) onLogin();
    else setError("Invalid admin secret");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 16, padding: 40, maxWidth: 380, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔐</div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>Admin Access</div>
        <div style={{ fontSize: 14, color: "var(--text-3)", marginBottom: 24 }}>CVCraft admin dashboard. Authorised personnel only.</div>
        <input type="password" value={secret} onChange={e => setSecret(e.target.value)} onKeyDown={e => e.key === "Enter" && check()}
          placeholder="Enter admin secret" style={{ width: "100%", background: "var(--bg-3)", border: "1px solid var(--border-2)", borderRadius: 8, padding: "10px 14px", color: "var(--text)", fontFamily: "'DM Sans',sans-serif", fontSize: 14, outline: "none", marginBottom: 12 }} />
        {error && <div style={{ fontSize: 13, color: "var(--danger)", marginBottom: 10 }}>{error}</div>}
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={check}>Enter Dashboard</button>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 14 }}>Default secret for demo: admin123</div>
      </div>
    </div>
  );
}

// ── ROOT ADMIN APP ────────────────────────────────────────────
export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [activePage, setActivePage] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Data — replace with real API calls in production
  const [users] = useState(generateMockData);
  const payments = generatePaymentLogs(users);
  const revenue = generateRevenueByMonth(users);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  if (!authed) return (
    <>
      <style>{CSS}</style>
      <AdminLogin onLogin={() => setAuthed(true)} />
    </>
  );

  const navItems = [
    { id: "overview",  icon: "📊", label: "Overview" },
    { id: "users",     icon: "👥", label: "Users" },
    { id: "payments",  icon: "💳", label: "Payments" },
    { id: "settings",  icon: "⚙️", label: "Settings" },
  ];

  const totalRevenue = payments.filter(p=>p.status==="success").reduce((s,p)=>s+p.amount,0);
  const paidUsers = users.filter(u=>u.plan!=="free").length;

  return (
    <>
      <style>{CSS}</style>
      <div className="admin-shell">
        {/* SIDEBAR */}
        <aside className="admin-nav">
          <div className="admin-logo">
            <div className="admin-logo-text">CV<span>Craft</span><span className="admin-logo-badge">ADMIN</span></div>
          </div>
          <div className="admin-nav-section">Menu</div>
          {navItems.map(item => (
            <button key={item.id} className={`admin-nav-item ${activePage===item.id?"active":""}`} onClick={()=>setActivePage(item.id)}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </button>
          ))}
          <div className="admin-nav-bottom">
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8 }}>Quick stats</div>
            {[
              { label: "Total Revenue", value: `₦${(totalRevenue/1000).toFixed(0)}k`, color: "var(--success)" },
              { label: "Paid Users",    value: paidUsers, color: "var(--accent)" },
              { label: "Total Users",   value: users.length, color: "var(--text-2)" },
            ].map((s,i)=>(
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>{s.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.color, fontFamily: "'IBM Plex Mono',monospace" }}>{s.value}</span>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 14, width: "100%", justifyContent: "center", fontSize: 12 }} onClick={() => setAuthed(false)}>
              Sign Out
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <div className="admin-main">
          <div className="admin-topbar">
            <div className="admin-topbar-title">
              {navItems.find(n=>n.id===activePage)?.icon} {navItems.find(n=>n.id===activePage)?.label}
            </div>
            <div className="admin-topbar-right">
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>{new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setLoading(true); setTimeout(() => { setLoading(false); showToast("Data refreshed ✓"); }, 800); }}>
                {loading ? <span className="spinner"/> : "↺"} Refresh
              </button>
            </div>
          </div>

          <div className="admin-content">
            {activePage === "overview"  && <OverviewPage stats={{}} users={users} payments={payments} revenue={revenue}/>}
            {activePage === "users"     && <UsersPage users={users}/>}
            {activePage === "payments"  && <PaymentsPage payments={payments}/>}
            {activePage === "settings"  && <SettingsPage/>}
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
