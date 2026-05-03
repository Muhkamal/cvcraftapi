# CVCraft API — Deployment Guide

## Stack
- **FastAPI** — Python backend
- **Supabase** — Postgres + Auth + Storage
- **WeasyPrint** — HTML → PDF generation
- **python-docx** — DOCX export
- **Anthropic Claude** — AI features
- **Paystack** — Payments (NGN)
- **Railway** — Hosting

---

## 1. Supabase Setup

1. Create a new project at https://supabase.com
2. Go to **SQL Editor → New Query**
3. Paste and run the entire contents of `schema.sql`
4. Go to **Settings → API** and copy:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_KEY`
   - `anon` key → `SUPABASE_ANON_KEY`

---

## 2. Paystack Setup

1. Sign up at https://paystack.com
2. Go to **Settings → API Keys & Webhooks**
3. Copy your **Secret Key** → `PAYSTACK_SECRET_KEY`
4. Under **Webhooks**, add:
   - URL: `https://your-api.railway.app/payments/webhook`
   - Copy the **webhook secret** → `PAYSTACK_WEBHOOK_SECRET`
5. Use `sk_test_...` for development, `sk_live_...` for production

---

## 3. Local Development

```bash
# Clone and enter directory
cd cvcraftapi

# Create virtualenv
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy env file and fill in values
cp .env.example .env

# Run development server
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

---

## 4. Railway Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway new

# Link to project
railway link

# Set environment variables (one by one or via dashboard)
railway variables set SUPABASE_URL=https://xxx.supabase.co
railway variables set SUPABASE_SERVICE_KEY=eyJ...
railway variables set SUPABASE_ANON_KEY=eyJ...
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set PAYSTACK_SECRET_KEY=sk_live_...
railway variables set PAYSTACK_WEBHOOK_SECRET=your_webhook_secret
railway variables set FRONTEND_URL=https://your-frontend.vercel.app

# Deploy
railway up
```

Your API will be live at: `https://your-project.railway.app`

---

## 5. Frontend Integration

Copy `api-client.ts` to `src/lib/api.ts` in your React project.

Set environment variable in your frontend:
```
VITE_API_URL=https://your-project.railway.app
```

Usage:
```typescript
import { api } from "@/lib/api"

// Login
const { session } = await api.auth.login(email, password)

// Save resume
await api.resumes.create({ title: "My Resume", template: "executive", ... })

// Export PDF
await api.exports.pdf(resumeId, "my-resume.pdf")

// AI bullets
const { bullets } = await api.ai.bullets("Software Engineer", "Google", jobDescText)

// Initialize payment
const { authorization_url } = await api.payments.initialize("pro", email)
window.location.href = authorization_url

// Verify after redirect back
await api.payments.verify(reference, "pro")
```

---

## 6. Payment Flow

```
User clicks "Upgrade"
  → POST /payments/initialize   (creates Paystack transaction)
  → Redirect to authorization_url (Paystack payment page)
  → User pays
  → Paystack redirects to your callback_url
  → Frontend calls POST /payments/verify with reference
  → Plan activated in Supabase

Simultaneously:
  → Paystack sends webhook to POST /payments/webhook
  → Backend verifies HMAC signature
  → Plan confirmed via background task (double safety)
```

---

## 7. API Endpoints Summary

| Method | Path | Auth | Plan |
|--------|------|------|------|
| POST | /auth/register | — | — |
| POST | /auth/login | — | — |
| GET | /auth/me | ✓ | any |
| GET | /resumes | ✓ | any |
| POST | /resumes | ✓ | any |
| GET | /resumes/{id} | ✓ | any |
| PUT | /resumes/{id} | ✓ | any |
| DELETE | /resumes/{id} | ✓ | any |
| POST | /export/pdf | ✓ | any* |
| POST | /export/docx | ✓ | pro+ |
| POST | /ai/bullets | ✓ | any |
| POST | /ai/summary | ✓ | any |
| POST | /ai/skills | ✓ | any |
| POST | /ai/match | ✓ | pro+ |
| POST | /payments/initialize | ✓ | any |
| POST | /payments/verify | ✓ | any |
| POST | /payments/webhook | — | — |
| GET | /user/subscription | ✓ | any |
| GET | /user/stats | ✓ | any |

*Free plan: 1 PDF/day limit enforced server-side

---

## 8. WeasyPrint Font Setup (Railway)

WeasyPrint needs system fonts. The Dockerfile installs:
- `fonts-liberation` (Arial/Times/Courier equivalents)
- `fonts-dejavu-core`

If you need Google Fonts in PDFs, embed them via `@import` in the HTML string
inside `build_resume_html()` in `main.py`.
