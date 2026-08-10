"""
Database seed script — creates initial departments and Admin user.
Run once after first migration:
    python seed.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
from app.models import User, Department, UserRole

from app.services.auth_service import hash_password

DEPARTMENTS = [
    "Squad1",
    "Accounts",
    "Squad1 R&D",
    "Functional",
    "Sales",
    "Services",
    "Consulting Services",
    "Operations Services",
    "Testing",
    "Others",
]

DEFAULT_ADMIN_EMAIL = "admin@talakunchi.com"
DEFAULT_ADMIN_PASSWORD = "ChangeMe@123!"
DEFAULT_ADMIN_NAME = "System Administrator"


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Seed departments
        for dept_name in DEPARTMENTS:
            existing = db.query(Department).filter(Department.name == dept_name).first()
            if not existing:
                db.add(Department(name=dept_name))
                print(f"  [+] Created department: {dept_name}")
            else:
                print(f"  [-] Department already exists: {dept_name}")

        # Seed default admin
        admin = db.query(User).filter(User.company_email == DEFAULT_ADMIN_EMAIL).first()
        if not admin:
            admin = User(
                company_email=DEFAULT_ADMIN_EMAIL,
                full_name=DEFAULT_ADMIN_NAME,
                role=UserRole.ADMIN,
                is_active=True,
                password_hash=hash_password(DEFAULT_ADMIN_PASSWORD),
            )
            db.add(admin)
            print(f"\n  [+] Created default admin: {DEFAULT_ADMIN_EMAIL}")
            print(f"  [!] Default password: {DEFAULT_ADMIN_PASSWORD}")
            print(f"  [!] CHANGE THIS PASSWORD IMMEDIATELY in production!")
        else:
            print(f"\n  [-] Admin already exists: {DEFAULT_ADMIN_EMAIL}")


        db.commit()
        print("\nSeed completed successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
