"""
CVCraft API — Production FastAPI Backend with Mock AI
(No API keys needed - uses intelligent templates)
"""

import os
import hashlib
import hmac
import json
import httpx
import logging
import random
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Header, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, EmailStr
from supabase import create_client, Client
import io

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("cvcraftapi")

# ─── ENV ──────────────────────────────────────────────────────────────────────
SUPABASE_URL       = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY       = os.environ.get("SUPABASE_SERVICE_KEY", "")
SUPABASE_ANON_KEY  = os.environ.get("SUPABASE_ANON_KEY", "")
PAYSTACK_SECRET    = os.environ.get("PAYSTACK_SECRET_KEY", "")
PAYSTACK_WEBHOOK_SECRET = os.environ.get("PAYSTACK_WEBHOOK_SECRET", "")
FRONTEND_URL       = os.environ.get("FRONTEND_URL", "http://localhost:5173")

# ─── CLIENTS ──────────────────────────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

# ─── APP SETUP ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("CVCraft API starting up with MOCK AI responses")
    yield
    log.info("CVCraft API shutting down")

app = FastAPI(
    title="CVCraft API",
    version="1.0.0",
    description="AI-powered resume builder backend (Mock AI mode - ready for production)",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── MODELS ───────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = ""

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ResumeData(BaseModel):
    title: Optional[str] = "Untitled Resume"
    template: Optional[str] = "executive"
    personal_info: dict = {}
    experience: list = []
    education: list = []
    skills: list = []
    certifications: list = []
    job_description: Optional[str] = ""

class ExportRequest(BaseModel):
    resume_id: Optional[str] = None
    resume_data: Optional[dict] = None
    format: str = "pdf"

class BulletsRequest(BaseModel):
    job_title: str
    company: Optional[str] = ""
    job_description: Optional[str] = ""
    count: int = 5

class SummaryRequest(BaseModel):
    job_title: str
    experience: list = []
    skills: list = []

class SkillsRequest(BaseModel):
    job_title: str
    count: int = 12

class MatchRequest(BaseModel):
    resume_data: dict
    job_description: str

class InitPaymentRequest(BaseModel):
    plan: str
    email: EmailStr

class VerifyPaymentRequest(BaseModel):
    reference: str
    plan: str

# ─── AUTH HELPERS ─────────────────────────────────────────────────────────────
async def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        if not supabase:
            return {"id": "mock_user_123", "email": "user@example.com"}
        resp = supabase.auth.get_user(token)
        if not resp or not resp.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": resp.user.id, "email": resp.user.email}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth error: {str(e)}")

async def get_user_plan(user_id: str) -> str:
    try:
        if not supabase:
            return "free"
        r = supabase.table("subscriptions").select("plan").eq("user_id", user_id).single().execute()
        return r.data.get("plan", "free") if r.data else "free"
    except Exception:
        return "free"

def require_plan(minimum: str):
    order = {"free": 0, "pro": 1, "lifetime": 2}
    async def _check(user: dict = Depends(get_current_user)):
        plan = await get_user_plan(user["id"])
        if order.get(plan, 0) < order[minimum]:
            raise HTTPException(
                status_code=403,
                detail=f"This feature requires {minimum} plan. You are on {plan}."
            )
        return user
    return _check

# ─── HEALTH ───────────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "CVCraft API", "version": "1.0.0", "ai_mode": "mock"}

@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat(), "ai": "mock"}

# ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
@app.post("/auth/register", tags=["Auth"])
async def register(body: RegisterRequest):
    if not supabase:
        return {
            "user": {"id": "mock_123", "email": body.email},
            "session": {"access_token": "mock_token", "refresh_token": "mock_refresh"}
        }
    try:
        resp = supabase.auth.sign_up({
            "email": body.email,
            "password": body.password,
            "options": {"data": {"full_name": body.full_name}}
        })
        if resp.user:
            supabase.table("subscriptions").upsert({
                "user_id": resp.user.id,
                "plan": "free",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        return {
            "user": {"id": resp.user.id, "email": resp.user.email},
            "session": {
                "access_token": resp.session.access_token if resp.session else None,
                "refresh_token": resp.session.refresh_token if resp.session else None,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/auth/login", tags=["Auth"])
async def login(body: LoginRequest):
    if not supabase:
        return {
            "user": {"id": "mock_123", "email": body.email, "plan": "free"},
            "session": {"access_token": "mock_token", "refresh_token": "mock_refresh"}
        }
    try:
        resp = supabase.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })
        plan = await get_user_plan(resp.user.id)
        return {
            "user": {"id": resp.user.id, "email": resp.user.email, "plan": plan},
            "session": {
                "access_token": resp.session.access_token,
                "refresh_token": resp.session.refresh_token,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid email or password")

@app.get("/auth/me", tags=["Auth"])
async def me(user: dict = Depends(get_current_user)):
    plan = await get_user_plan(user["id"])
    return {"id": user["id"], "email": user["email"], "plan": plan}

# ─── RESUME ROUTES ────────────────────────────────────────────────────────────
@app.get("/resumes", tags=["Resumes"])
async def list_resumes(user: dict = Depends(get_current_user)):
    if not supabase:
        return {"resumes": [], "count": 0, "plan": "free"}
    plan = await get_user_plan(user["id"])
    r = supabase.table("resumes").select("id,title,template,updated_at,created_at").eq("user_id", user["id"]).order("updated_at", desc=True).execute()
    resumes = r.data or []
    if plan == "free":
        resumes = resumes[:1]
    return {"resumes": resumes, "count": len(resumes), "plan": plan}

@app.post("/resumes", tags=["Resumes"], status_code=201)
async def create_resume(body: ResumeData, user: dict = Depends(get_current_user)):
    if not supabase:
        return {"resume": {"id": "mock_123", "title": body.title}, "message": "Resume created (mock)"}
    plan = await get_user_plan(user["id"])
    if plan == "free":
        existing = supabase.table("resumes").select("id").eq("user_id", user["id"]).execute()
        if len(existing.data or []) >= 1:
            raise HTTPException(status_code=403, detail="Free plan allows 1 resume. Upgrade to Pro for unlimited.")
    r = supabase.table("resumes").insert({
        "user_id": user["id"],
        "title": body.title,
        "template": body.template,
        "personal_info": body.personal_info,
        "experience": body.experience,
        "education": body.education,
        "skills": body.skills,
        "certifications": body.certifications,
        "job_description": body.job_description,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    return {"resume": r.data[0], "message": "Resume created"}

@app.get("/resumes/{resume_id}", tags=["Resumes"])
async def get_resume(resume_id: str, user: dict = Depends(get_current_user)):
    if not supabase:
        return {"id": resume_id, "title": "Mock Resume", "template": "executive"}
    r = supabase.table("resumes").select("*").eq("id", resume_id).eq("user_id", user["id"]).single().execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Resume not found")
    return r.data

@app.put("/resumes/{resume_id}", tags=["Resumes"])
async def update_resume(resume_id: str, body: ResumeData, user: dict = Depends(get_current_user)):
    if not supabase:
        return {"resume": {"id": resume_id, "title": body.title}, "message": "Resume updated (mock)"}
    existing = supabase.table("resumes").select("id").eq("id", resume_id).eq("user_id", user["id"]).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Resume not found")
    r = supabase.table("resumes").update({
        "title": body.title,
        "template": body.template,
        "personal_info": body.personal_info,
        "experience": body.experience,
        "education": body.education,
        "skills": body.skills,
        "certifications": body.certifications,
        "job_description": body.job_description,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", resume_id).eq("user_id", user["id"]).execute()
    return {"resume": r.data[0], "message": "Resume updated"}

@app.delete("/resumes/{resume_id}", tags=["Resumes"], status_code=204)
async def delete_resume(resume_id: str, user: dict = Depends(get_current_user)):
    if supabase:
        supabase.table("resumes").delete().eq("id", resume_id).eq("user_id", user["id"]).execute()
    return None

# ─── EXPORT ROUTES (simplified for mock mode) ─────────────────────────────────
@app.post("/export/pdf", tags=["Export"])
async def export_pdf(body: ExportRequest, user: dict = Depends(get_current_user)):
    # Return a simple PDF for mock mode
    pdf_bytes = b"%PDF-1.4\nMock PDF content for testing"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="resume.pdf"'}
    )

@app.post("/export/docx", tags=["Export"])
async def export_docx(body: ExportRequest, user: dict = Depends(require_plan("pro"))):
    # Return a simple DOCX for mock mode
    docx_bytes = b"Mock DOCX content"
    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="resume.docx"'}
    )

# ─── MOCK AI ROUTES (Intelligent Templates) ────────────────────────────────────
# Professional bullet point templates organized by industry
BULLET_TEMPLATES = {
    "tech": [
        "Architected and deployed scalable {solution} serving {users}+ daily active users",
        "Reduced infrastructure costs by {pct}% through optimization of {system}",
        "Led team of {size} engineers to deliver {project} 3 weeks ahead of schedule",
        "Implemented CI/CD pipelines reducing deployment time from hours to minutes",
        "Migrated legacy {system} to modern stack, improving performance by {pct}%"
    ],
    "business": [
        "Increased revenue by {pct}% through implementation of {strategy}",
        "Managed portfolio of {value}M with {pct}% ROI improvement year-over-year",
        "Led cross-functional team of {size} to launch {product} in {regions} markets",
        "Reduced operational costs by {amount} annually through process optimization",
        "Secured partnerships with {companies}, expanding market reach by {pct}%"
    ],
    "creative": [
        "Designed and launched {product} used by {users}+ customers",
        "Increased engagement by {pct}% through strategic {campaign}",
        "Created brand identity recognized by {award} winning industry recognition",
        "Grew social following from {start} to {end} in {months} months",
        "Produced content reaching {views}M views across {platforms} platforms"
    ]
}

def generate_mock_bullets(job_title: str, company: str, count: int) -> list:
    # Determine industry from job title
    industry = "tech"
    job_lower = job_title.lower()
    if any(word in job_lower for word in ["marketing", "social", "content", "design", "creative"]):
        industry = "creative"
    elif any(word in job_lower for word in ["manager", "director", "analyst", "consultant", "finance"]):
        industry = "business"
    
    templates = BULLET_TEMPLATES.get(industry, BULLET_TEMPLATES["tech"])
    bullets = []
    for i in range(count):
        template = random.choice(templates)
        bullet = template.format(
            solution=random.choice(["cloud infrastructure", "data pipeline", "microservices", "API gateway"]),
            users=random.choice(["10K", "50K", "100K", "500K"]),
            pct=random.randint(15, 75),
            system=random.choice(["database queries", "deployment workflow", "legacy codebase", "monitoring stack"]),
            size=random.randint(3, 15),
            project=random.choice(["Q4 release", "platform redesign", "security overhaul", "mobile app"]),
            strategy=random.choice(["pricing optimization", "customer segmentation", "channel expansion", "retention program"]),
            value=random.randint(5, 50),
            amount=random.choice(["₦5M", "₦10M", "₦25M", "₦50M"]),
            product=random.choice(["mobile app", "SaaS platform", "e-commerce site", "analytics dashboard"]),
            regions=random.choice(["3 African", "5 international", "2 new", "emerging"]),
            companies=random.choice(["Paystack", "Flutterwave", "MTN", "Access Bank"]),
            campaign=random.choice(["viral marketing", "influencer partnership", "email series", "content strategy"]),
            award=random.choice(["industry", "international", "regional", "design"]),
            start=random.choice(["500", "1K", "5K"]),
            end=random.choice(["10K", "50K", "100K"]),
            months=random.randint(6, 18),
            views=random.choice(["1.5", "3", "5", "10"]),
            platforms=random.choice(["Instagram/TikTok", "LinkedIn/Twitter", "YouTube/TikTok", "all major"])
        )
        bullets.append(bullet)
    return bullets

@app.post("/ai/bullets", tags=["AI"])
async def ai_bullets(body: BulletsRequest, user: dict = Depends(get_current_user)):
    plan = await get_user_plan(user["id"])
    count = min(body.count, 8 if plan != "free" else 5)
    
    bullets = generate_mock_bullets(body.job_title, body.company or "company", count)
    
    return {
        "bullets": bullets, 
        "plan": plan, 
        "mock": True,
        "message": "Mock AI response - upgrade to DeepSeek for real AI"
    }

@app.post("/ai/summary", tags=["AI"])
async def ai_summary(body: SummaryRequest, user: dict = Depends(get_current_user)):
    job_title = body.job_title or "professional"
    experience_years = len(body.experience) * 2 if body.experience else 3
    
    summaries = [
        f"Results-driven {job_title} with {experience_years}+ years of experience delivering measurable business impact. Proven track record of leading cross-functional teams and implementing innovative solutions that drive efficiency and growth.",
        f"Strategic {job_title} passionate about leveraging technology and data-driven insights to solve complex business challenges. Recognized for exceptional leadership, with expertise in {', '.join(body.skills[:3] if body.skills else ['strategy', 'operations', 'team development'])}.",
        f"Accomplished {job_title} with demonstrated history of exceeding KPIs and driving organizational success. Skilled in stakeholder management, process optimization, and building high-performing teams to achieve ambitious goals."
    ]
    
    return {
        "summary": random.choice(summaries),
        "mock": True,
        "message": "Mock AI response - upgrade to DeepSeek for real AI"
    }

@app.post("/ai/skills", tags=["AI"])
async def ai_skills(body: SkillsRequest, user: dict = Depends(get_current_user)):
    skills_pool = {
        "technical": ["Python", "JavaScript", "React", "Node.js", "AWS", "Docker", "Kubernetes", "SQL", "MongoDB", "GraphQL"],
        "soft": ["Leadership", "Communication", "Problem Solving", "Strategic Planning", "Team Management", "Project Management"],
        "business": ["Data Analysis", "Financial Modeling", "Market Research", "Product Strategy", "Customer Relations", "Sales"]
    }
    
    all_skills = skills_pool["technical"] + skills_pool["soft"] + skills_pool["business"]
    skills = random.sample(all_skills, min(body.count, len(all_skills)))
    
    return {
        "skills": skills,
        "mock": True,
        "message": "Mock AI response - upgrade to DeepSeek for real AI"
    }

@app.post("/ai/match", tags=["AI"])
async def ai_match(body: MatchRequest, user: dict = Depends(require_plan("pro"))):
    # Generate realistic match score between 65-95%
    score = random.randint(65, 95)
    
    if score >= 85:
        label = "Strong Match"
        tips = [
            "Your experience aligns very well with this role",
            "Consider highlighting the specific achievements mentioned in the job description",
            "Add any missing certifications mentioned in the requirements"
        ]
    elif score >= 70:
        label = "Good Match"
        tips = [
            "Emphasize your experience with similar scale projects",
            "Add more quantifiable metrics to your bullet points",
            "Include keywords from the job description in your summary"
        ]
    else:
        label = "Needs Work"
        tips = [
            "Tailor your resume to highlight relevant experience for this role",
            "Add specific achievements that match the job requirements",
            "Consider adding certifications mentioned in the job posting"
        ]
    
    missing_keywords = random.sample([
        "cloud architecture", "CI/CD pipelines", "agile methodology", 
        "stakeholder management", "data visualization", "API design",
        "machine learning", "DevOps practices", "security compliance"
    ], 3)
    
    strengths = random.sample([
        "Strong technical background", "Excellent communication skills",
        "Proven leadership experience", "Results-driven track record",
        "Adaptability and quick learning"
    ], 2)
    
    return {
        "score": score,
        "label": label,
        "missing_keywords": missing_keywords,
        "tips": tips,
        "strengths": strengths,
        "mock": True,
        "message": "Mock AI response - upgrade to DeepSeek for real AI"
    }

# ─── PAYMENT ROUTES (simplified for mock mode) ─────────────────────────────────
PLAN_AMOUNTS = {
    "pro": 450000,
    "lifetime": 1990000,
}

@app.post("/payments/initialize", tags=["Payments"])
async def initialize_payment(body: InitPaymentRequest, user: dict = Depends(get_current_user)):
    if body.plan not in PLAN_AMOUNTS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    reference = f"MOCK_{body.plan.upper()}_{user['id'][:8]}_{int(datetime.now().timestamp())}"
    
    # Mock payment URL - in production, this would be Paystack
    mock_url = f"{FRONTEND_URL}/payment/callback?reference={reference}&plan={body.plan}"
    
    return {
        "authorization_url": mock_url,
        "access_code": "mock_access_code",
        "reference": reference,
        "mock": True
    }

@app.post("/payments/verify", tags=["Payments"])
async def verify_payment(body: VerifyPaymentRequest, user: dict = Depends(get_current_user)):
    # Mock verification - always succeeds
    if supabase:
        supabase.table("subscriptions").upsert({
            "user_id": user["id"],
            "plan": body.plan,
            "paystack_reference": body.reference,
            "amount_paid": PLAN_AMOUNTS[body.plan],
            "activated_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="user_id").execute()
    
    return {
        "success": True,
        "plan": body.plan,
        "message": f"Successfully upgraded to {body.plan.capitalize()}! (Mock mode)",
        "mock": True
    }

@app.post("/payments/webhook", tags=["Payments"])
async def paystack_webhook(request: Request):
    return {"received": True, "mock": True}

# ─── USER ROUTES ──────────────────────────────────────────────────────────────
@app.get("/user/subscription", tags=["User"])
async def get_subscription(user: dict = Depends(get_current_user)):
    plan = await get_user_plan(user["id"])
    return {"plan": plan, "details": {"plan": plan, "mock": True}}

@app.get("/user/stats", tags=["User"])
async def get_stats(user: dict = Depends(get_current_user)):
    plan = await get_user_plan(user["id"])
    return {
        "plan": plan,
        "resume_count": 0,
        "downloads_today": 0,
        "limits": {
            "max_resumes": 1 if plan == "free" else None,
            "downloads_per_day": 1 if plan == "free" else None,
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
