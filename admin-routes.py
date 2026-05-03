"""
Admin routes — append these to main.py
Protect with ADMIN_SECRET env var.
Mount at: /admin/*
"""

import os
from fastapi import APIRouter, Header, HTTPException
from datetime import datetime, timezone, timedelta

ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "change_this_in_production")

admin = APIRouter(prefix="/admin", tags=["Admin"])

def require_admin(x_admin_secret: str = Header(None)):
    if x_admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Invalid admin secret")

# ── Overview Stats ────────────────────────────────────────────
@admin.get("/stats")
async def admin_stats(_=Depends(require_admin)):
    # Users
    users_r = supabase.table("subscriptions").select("plan", count="exact").execute()
    all_subs = users_r.data or []
    plan_counts = {"free": 0, "pro": 0, "lifetime": 0}
    for s in all_subs:
        plan_counts[s["plan"]] = plan_counts.get(s["plan"], 0) + 1

    # Revenue
    payments_r = supabase.table("payment_logs").select("amount,status,created_at").eq("status", "success").execute()
    payments = payments_r.data or []
    total_revenue = sum(p["amount"] for p in payments) // 100  # kobo to naira

    # MRR
    mrr = (plan_counts["pro"] * 4500)

    # New users this week
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    new_users_r = supabase.table("subscriptions").select("id", count="exact").gte("created_at", week_ago).execute()

    # Total resumes
    resumes_r = supabase.table("resumes").select("id", count="exact").execute()

    # Total downloads
    downloads_r = supabase.table("download_logs").select("id", count="exact").execute()

    return {
        "total_users":   len(all_subs),
        "plan_counts":   plan_counts,
        "total_revenue": total_revenue,
        "mrr":           mrr,
        "new_this_week": new_users_r.count or 0,
        "total_resumes": resumes_r.count or 0,
        "total_downloads": downloads_r.count or 0,
        "conversion_rate": round(((plan_counts["pro"] + plan_counts["lifetime"]) / max(len(all_subs), 1)) * 100, 1),
    }

# ── Monthly Revenue ───────────────────────────────────────────
@admin.get("/revenue/monthly")
async def admin_revenue_monthly(_=Depends(require_admin)):
    """Revenue grouped by month for chart."""
    payments_r = supabase.table("payment_logs").select("amount,created_at,plan").eq("status","success").order("created_at").execute()
    payments = payments_r.data or []

    monthly = {}
    for p in payments:
        month = p["created_at"][:7]  # YYYY-MM
        if month not in monthly:
            monthly[month] = {"month": month, "revenue": 0, "transactions": 0}
        monthly[month]["revenue"] += p["amount"] // 100
        monthly[month]["transactions"] += 1

    return {"monthly": list(monthly.values())[-12:]}  # last 12 months

# ── Users List ────────────────────────────────────────────────
@admin.get("/users")
async def admin_users(limit: int = 50, offset: int = 0, plan: str = None, search: str = None, _=Depends(require_admin)):
    query = supabase.table("subscriptions").select("user_id,plan,created_at,updated_at,paystack_reference,amount_paid")

    if plan and plan != "all":
        query = query.eq("plan", plan)

    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    subs_r = query.execute()
    subs = subs_r.data or []

    # Enrich with auth user data
    result = []
    for s in subs:
        try:
            auth_user = supabase.auth.admin.get_user_by_id(s["user_id"])
            user_email = auth_user.user.email if auth_user.user else "unknown"
            user_meta = auth_user.user.user_metadata or {}
        except Exception:
            user_email = "unknown"
            user_meta = {}

        if search and search.lower() not in user_email.lower() and search.lower() not in user_meta.get("full_name","").lower():
            continue

        # Resume count
        resume_count_r = supabase.table("resumes").select("id", count="exact").eq("user_id", s["user_id"]).execute()

        result.append({
            "user_id":  s["user_id"],
            "email":    user_email,
            "name":     user_meta.get("full_name", ""),
            "plan":     s["plan"],
            "resumes":  resume_count_r.count or 0,
            "joined":   s["created_at"],
            "amount_paid": s.get("amount_paid", 0),
        })

    return {"users": result, "total": len(result)}

# ── Payment Logs ──────────────────────────────────────────────
@admin.get("/payments")
async def admin_payments(limit: int = 100, status: str = None, _=Depends(require_admin)):
    query = supabase.table("payment_logs").select("*").order("created_at", desc=True)
    if status and status != "all":
        query = query.eq("status", status)
    query = query.limit(limit)
    r = query.execute()
    return {"payments": r.data or [], "total": len(r.data or [])}

# ── Grant Plan ────────────────────────────────────────────────
@admin.post("/users/{user_id}/grant-plan")
async def grant_plan(user_id: str, plan: str, _=Depends(require_admin)):
    if plan not in ("free", "pro", "lifetime"):
        raise HTTPException(status_code=400, detail="Invalid plan")
    supabase.table("subscriptions").upsert({
        "user_id": user_id, "plan": plan,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="user_id").execute()
    log.info(f"Admin granted plan: user={user_id} plan={plan}")
    return {"success": True, "user_id": user_id, "plan": plan}

# ── Export Users CSV ──────────────────────────────────────────
@admin.get("/export/users-csv")
async def export_users_csv(_=Depends(require_admin)):
    subs_r = supabase.table("subscriptions").select("*").execute()
    subs = subs_r.data or []

    rows = ["user_id,plan,amount_paid,created_at"]
    for s in subs:
        rows.append(f"{s['user_id']},{s['plan']},{s.get('amount_paid',0)},{s['created_at']}")

    return StreamingResponse(
        io.BytesIO("\n".join(rows).encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=cvcraft_users.csv"}
    )

# ── Cover Letter Export Route (add to main.py) ────────────────
# POST /export/cover-letter
# Body: { html: string, name: string }
@app.post("/export/cover-letter", tags=["Export"])
async def export_cover_letter_pdf(request: Request, user: dict = Depends(require_plan("pro"))):
    body = await request.json()
    html = body.get("html", "")
    name = body.get("name", "cover-letter")
    if not html:
        raise HTTPException(status_code=400, detail="No HTML provided")
    pdf_bytes = await html_to_pdf(html)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{name}_cover_letter.pdf"'}
    )

# ── Register admin router ─────────────────────────────────────
# Add this line in main.py after app is created:
# app.include_router(admin)
"""
HOW TO WIRE IN:

1. Copy the admin router code (above) into main.py

2. At the bottom of main.py, add:
   app.include_router(admin)

3. Add ADMIN_SECRET to your .env:
   ADMIN_SECRET=your_very_long_random_secret_here

4. In the admin dashboard React app, set:
   window.__ADMIN_SECRET__ = "your_very_long_random_secret_here"
   Or read from environment:
   const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET

5. Deploy admin dashboard on a separate route:
   /admin → AdminDashboard component
   Or host separately for security

6. Admin API calls use header:
   X-Admin-Secret: your_secret
"""
