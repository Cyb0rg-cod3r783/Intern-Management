# Talakunchi Intern Management System

## Monorepo structure

```
/
├── backend/     # FastAPI + Python backend
├── frontend/    # Next.js frontend
└── README.md
```

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 20+
- PostgreSQL 16

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate         # Windows
# or: source venv/bin/activate  # Linux/macOS

pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env with your actual database URL, keys, etc.

# Run migrations
alembic upgrade head

# Seed initial data (departments + default admin)
python seed.py

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Default Admin Account

After running `seed.py`:
- Email: `admin@talakunchi.com`
- Password: `ChangeMe@123!`

**Change this password immediately after first login.**

## Security Notes

- Bank account numbers are AES-256 encrypted at rest
- All sensitive fields require Admin role at the API level
- Managers cannot access stipend, bank, or personal data
- Audit logs track all sensitive access
- Both `@talakunchi.in` (interns) and `@talakunchi.com` (managers/admins) email domains are permitted


## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TailwindCSS, shadcn/ui |
| Backend | FastAPI, Python 3.12 |
| Database | PostgreSQL 16 |
| ORM | SQLAlchemy 2.0 + Alembic |
| Auth | Google OAuth / Email+Password |
| Encryption | Fernet (AES-128-CBC + HMAC-SHA256) |
