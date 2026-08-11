"""
Admin router — analytics dashboard, user management, data export.
All endpoints require Admin role.
"""
from datetime import date, datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import csv
import io

from app.database import get_db
from app.models import User, UserRole, InternProfile, Task, Department, AuditAction
from app.models.enums import InternStatus, TaskStatus
from app.middleware.rbac import require_admin, require_manager

from app.services.auth_service import hash_password, is_allowed_domain
from app.services.audit_service import log_action
from app.services.notification_service import notify_admins
from app.schemas.misc import UserCreateRequest, UserUpdateRequest, UserOut

router = APIRouter(prefix="/admin", tags=["Admin"])


# ─── Analytics dashboard ───────────────────────────────────────────────────────
@router.get("/analytics")
def get_analytics(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only analytics summary."""
    today = date.today()
    in_30_days = today + timedelta(days=30)

    total = db.query(InternProfile).count()
    active = db.query(InternProfile).filter(InternProfile.status == InternStatus.ACTIVE).count()
    alumni = db.query(InternProfile).filter(InternProfile.status == InternStatus.ALUMNI).count()
    inactive = db.query(InternProfile).filter(InternProfile.status == InternStatus.INACTIVE).count()

    # Paid vs unpaid (ADMIN-ONLY)
    paid = db.query(InternProfile).filter(InternProfile.is_paid == True).count()
    unpaid = db.query(InternProfile).filter(
        (InternProfile.is_paid == False) | (InternProfile.is_paid == None)
    ).count()

    # Ending soon
    ending_soon = db.query(InternProfile).filter(
        InternProfile.end_date.between(today, in_30_days),
        InternProfile.status == InternStatus.ACTIVE,
    ).count()

    # By department
    by_dept = db.query(
        Department.name, func.count(InternProfile.id)
    ).join(InternProfile, InternProfile.department_id == Department.id, isouter=True) \
     .group_by(Department.name).all()

    # Task stats
    total_tasks = db.query(Task).count()
    completed_tasks = db.query(Task).filter(Task.status == TaskStatus.COMPLETED).count()
    in_progress_tasks = db.query(Task).filter(Task.status == TaskStatus.IN_PROGRESS).count()
    blocked_tasks = db.query(Task).filter(Task.status == TaskStatus.BLOCKED).count()

    # Overdue (computed)
    all_open_tasks = db.query(Task).filter(
        Task.status != TaskStatus.COMPLETED,
        Task.due_date < today,
    ).count()

    # Stipend summary (ADMIN-ONLY)
    stipend_total = db.query(func.sum(InternProfile.stipend_amount)).scalar() or 0

    return {
        "interns": {
            "total": total,
            "active": active,
            "alumni": alumni,
            "inactive": inactive,
            "paid": paid,
            "unpaid": unpaid,
            "ending_soon_30_days": ending_soon,
        },
        "by_department": [{"name": name, "count": count} for name, count in by_dept],
        "tasks": {
            "total": total_tasks,
            "completed": completed_tasks,
            "in_progress": in_progress_tasks,
            "blocked": blocked_tasks,
            "overdue": all_open_tasks,
            "completion_rate": round(completed_tasks / total_tasks * 100, 1) if total_tasks else 0,
        },
        "financial": {
            "total_monthly_stipend": float(stipend_total),
            "paid_interns": paid,
            "unpaid_interns": unpaid,
        },
    }


# ─── User management ───────────────────────────────────────────────────────────
@router.get("/users", response_model=List[UserOut])
def list_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).all()
    return [UserOut.model_validate(u) for u in users]


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin creates a Manager or Admin user account."""
    if not is_allowed_domain(body.company_email):
        raise HTTPException(status_code=400, detail="Only @talakunchi.com and @talakunchi.in emails are permitted.")


    existing = db.query(User).filter(User.company_email == body.company_email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already exists.")

    role_map = {"ADMIN": UserRole.ADMIN, "MANAGER": UserRole.MANAGER, "INTERN": UserRole.INTERN}
    role = role_map.get(body.role.upper())
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role.")

    user = User(
        company_email=body.company_email.lower(),
        full_name=body.full_name,
        role=role,
        is_active=True,
        department_id=body.department_id,
        password_hash=hash_password(body.initial_password) if body.initial_password else None,
    )
    db.add(user)
    log_action(db, str(current_user.id), AuditAction.USER_CREATED,
               metadata={"email": body.company_email, "role": body.role})
    db.commit()
    db.refresh(user)

    # Trigger: Account Created Alert to Admins
    notify_admins(
        db, "👤 New Account Created",
        f"New {user.role.value} account created for {user.company_email} ({user.full_name}).",
        "ACCOUNT_CREATED", "/admin/managers"
    )
    db.commit()

    return UserOut.model_validate(user)


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    body: UserUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin only: edit a user account (Name, Email, Role, Department, Active status)."""
    import uuid as _uuid
    user = db.query(User).filter(User.id == _uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if body.company_email and body.company_email.lower() != user.company_email:
        new_email = body.company_email.lower()
        if not is_allowed_domain(new_email):
            raise HTTPException(status_code=400, detail="Only @talakunchi.com and @talakunchi.in emails are permitted.")
        existing = db.query(User).filter(User.company_email == new_email).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email is already in use by another account.")
        user.company_email = new_email

    if body.full_name is not None:
        user.full_name = body.full_name

    if body.role is not None:
        role_map = {"ADMIN": UserRole.ADMIN, "MANAGER": UserRole.MANAGER, "INTERN": UserRole.INTERN}
        r = role_map.get(body.role.upper())
        if not r:
            raise HTTPException(status_code=400, detail="Invalid role.")
        user.role = r

    if body.department_id is not None:
        user.department_id = body.department_id

    if body.is_active is not None:
        user.is_active = body.is_active

    log_action(db, str(current_user.id), AuditAction.USER_CREATED,
               target_type="user", target_id=user_id,
               metadata={"email": user.company_email, "action": "update_user"})
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/managers")
def list_managers(
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
):

    """Admin: list all managers (for assignment dropdowns)."""
    managers = db.query(User).filter(
        User.role == UserRole.MANAGER,
        User.is_active == True,
    ).all()
    return [{"id": str(m.id), "full_name": m.full_name, "company_email": m.company_email,
             "department_id": str(m.department_id) if m.department_id else None}
            for m in managers]


# ─── Data export (Admin-only) ──────────────────────────────────────────────────
@router.get("/export/interns")
def export_interns_csv(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only: export all intern data as CSV (includes sensitive fields)."""
    from app.services.crypto_service import decrypt_optional

    profiles = db.query(InternProfile).join(User, InternProfile.user_id == User.id).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Full Name", "Company Email", "New TK ID", "Old TK ID", "Department",
        "Reporting Manager", "Title", "Category", "Location", "Internship Type",
        "Duration", "Joining Date", "End Date", "Status",
        "Personal Email", "Marital Status", "Stipend Amount", "Stipend Type",
        "Is Paid", "Bank Name", "Bank IFSC", "Bank Account (Encrypted)",
        "Remarks",
    ])

    for p in profiles:
        writer.writerow([
            p.user.full_name if p.user else "",
            p.user.company_email if p.user else "",
            p.new_tk_id or "",
            p.old_tk_id or "",
            p.department.name if p.department else "",
            p.reporting_manager.full_name if p.reporting_manager else "",
            p.title or "",
            p.category or "",
            p.location or "",
            p.internship_type or "",
            p.duration or "",
            str(p.joining_date) if p.joining_date else "",
            str(p.end_date) if p.end_date else "",
            p.status.value if p.status else "",
            p.personal_email or "",
            p.marital_status or "",
            str(p.stipend_amount) if p.stipend_amount else "",
            p.stipend_type or "",
            str(p.is_paid) if p.is_paid is not None else "",
            p.bank_name or "",
            p.bank_ifsc or "",
            decrypt_optional(p.bank_account_number_encrypted) or "",
            p.remarks or "",
        ])

    log_action(db, str(current_user.id), AuditAction.EXPORT_DATA,
               metadata={"type": "intern_csv", "count": len(profiles)})
    db.commit()

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=interns_export.csv"},
    )


# ─── Bulk Import & Template ────────────────────────────────────────────────────
REQUIRED_BULK_COLUMNS = [
    "full_name", "company_email", "tk_id", "joining_date", "end_date",
    "duration", "department", "manager_email", "category", "internship_type",
    "location", "remarks", "personal_email", "personal_phone", "stipend_amount",
    "initial_password"
]


@router.get("/export/bulk-template")
def download_bulk_template(current_user: User = Depends(require_admin)):
    """Download a pre-formatted CSV template with all 16 required column headers."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(REQUIRED_BULK_COLUMNS)
    writer.writerow([
        "Rahul Shah", "rahul.shah@talakunchi.in", "TK-2026-001", "2026-08-01", "2026-10-30",
        "3 Months", "Squad1 R&D", "sam.boston@talakunchi.in", "intern", "paid",
        "Mumbai", "Batch 2026 Onboarding", "rahul.personal@gmail.com", "+919876543210", "15000",
        "Welcome@123"
    ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=interns_bulk_template.csv"},
    )


@router.post("/interns/bulk-import")
async def bulk_import_interns(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Bulk import interns from a CSV or Excel file.
    ALL 16 COLUMNS ARE STRICTLY REQUIRED.
    """
    filename = file.filename.lower()
    contents = await file.read()

    rows = []
    if filename.endswith(".csv"):
        text = contents.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        for r in reader:
            rows.append({(k or "").replace('\xa0', ' ').strip().lower(): (v or "").replace('\xa0', ' ').strip() for k, v in r.items()})
    elif filename.endswith(".xlsx") or filename.endswith(".xls"):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
            sheet = wb.active
            data = list(sheet.iter_rows(values_only=True))
            if not data:
                raise HTTPException(status_code=400, detail="Excel file is empty.")
            headers = [str(h).strip().lower() if h is not None else "" for h in data[0]]
            for r in data[1:]:
                if any(r):
                    row_dict = {headers[i]: (str(r[i]).replace('\xa0', ' ').strip() if i < len(r) and r[i] is not None else "") for i in range(len(headers))}
                    rows.append(row_dict)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are supported.")

    if not rows:
        raise HTTPException(status_code=400, detail="File contains no data rows.")

    # 1. Validate all 16 column headers are present
    first_row_headers = [k.strip().lower() for k in rows[0].keys()]
    missing_headers = [col for col in REQUIRED_BULK_COLUMNS if col not in first_row_headers]
    if missing_headers:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required column headers: {', '.join(missing_headers)}. All 16 columns are strictly required."
        )

    # Pre-fetch departments & managers
    all_depts = db.query(Department).all()
    dept_map = {d.name.strip().lower(): d for d in all_depts}
    dept_id_map = {str(d.id): d for d in all_depts}

    all_managers = db.query(User).filter(User.role.in_([UserRole.MANAGER, UserRole.ADMIN])).all()
    manager_map = {m.company_email.strip().lower(): m for m in all_managers}

    existing_emails = {u.company_email.strip().lower() for u in db.query(User.company_email).all()}

    errors = []
    validated_data = []

    # 2. Row by Row Validation
    for idx, r in enumerate(rows, start=2):  # 1-indexed row number (header is row 1)
        row_errors = []

        full_name = r.get("full_name", "").strip()
        company_email = r.get("company_email", "").strip().lower()
        tk_id = r.get("tk_id", "").strip()
        joining_date_str = r.get("joining_date", "").strip()
        end_date_str = r.get("end_date", "").strip()
        duration = r.get("duration", "").strip()
        dept_name = r.get("department", "").strip()
        manager_email = r.get("manager_email", "").strip().lower()
        category = r.get("category", "").strip().lower()
        internship_type = r.get("internship_type", "").strip().lower()
        location = r.get("location", "").strip()
        remarks = r.get("remarks", "").strip()
        personal_email = r.get("personal_email", "").strip()
        personal_phone = r.get("personal_phone", "").strip()
        stipend_amount_str = r.get("stipend_amount", "").strip()
        initial_password = r.get("initial_password", "").strip()

        # Check required non-empty cells for all 16 columns
        empty_fields = []
        for col in REQUIRED_BULK_COLUMNS:
            if not r.get(col, "").strip():
                empty_fields.append(col)
        if empty_fields:
            row_errors.append(f"Missing values for column(s): {', '.join(empty_fields)}")

        if company_email:
            if not (company_email.endswith("@talakunchi.com") or company_email.endswith("@talakunchi.in")):
                row_errors.append(f"Invalid email domain for '{company_email}'. Must end in @talakunchi.com or @talakunchi.in")
            elif company_email in existing_emails:
                row_errors.append(f"Email '{company_email}' already exists in the system")

        # Resolve department
        dept_obj = None
        if dept_name:
            dept_obj = dept_map.get(dept_name.lower()) or dept_id_map.get(dept_name)
            if not dept_obj:
                row_errors.append(f"Department '{dept_name}' not found")

        # Resolve manager
        mgr_obj = None
        if manager_email:
            mgr_obj = manager_map.get(manager_email.lower())
            if not mgr_obj:
                row_errors.append(f"Manager with email '{manager_email}' not found")

        # Category validation
        if category and category not in ("trainee", "contract", "intern"):
            row_errors.append(f"Invalid category '{category}'. Must be one of: trainee, contract, intern")

        # Internship type validation
        if internship_type and internship_type not in ("paid", "unpaid"):
            row_errors.append(f"Invalid internship_type '{internship_type}'. Must be paid or unpaid")

        # Stipend conversion
        stipend_val = 0.0
        if internship_type == "unpaid":
            stipend_val = 0.0
        elif stipend_amount_str:
            try:
                stipend_val = float(stipend_amount_str)
            except ValueError:
                row_errors.append(f"Invalid stipend amount '{stipend_amount_str}'")

        # Dates validation
        j_date, e_date = None, None
        if joining_date_str:
            try:
                j_date = datetime.strptime(joining_date_str[:10], "%Y-%m-%d").date()
            except ValueError:
                try:
                    j_date = datetime.strptime(joining_date_str[:10], "%d/%m/%Y").date()
                except ValueError:
                    row_errors.append(f"Invalid joining_date '{joining_date_str}'. Use YYYY-MM-DD")
        if end_date_str:
            try:
                e_date = datetime.strptime(end_date_str[:10], "%Y-%m-%d").date()
            except ValueError:
                try:
                    e_date = datetime.strptime(end_date_str[:10], "%d/%m/%Y").date()
                except ValueError:
                    row_errors.append(f"Invalid end_date '{end_date_str}'. Use YYYY-MM-DD")

        if row_errors:
            errors.append({"row": idx, "email": company_email or "Line " + str(idx), "errors": row_errors})
        else:
            validated_data.append({
                "full_name": full_name,
                "company_email": company_email,
                "new_tk_id": tk_id,
                "joining_date": j_date,
                "end_date": e_date,
                "duration": duration,
                "department_id": dept_obj.id if dept_obj else None,
                "reporting_manager_id": mgr_obj.id if mgr_obj else None,
                "category": category,
                "internship_type": internship_type,
                "location": location,
                "remarks": remarks,
                "personal_email": personal_email,
                "personal_phone": personal_phone,
                "stipend_amount": stipend_val,
                "initial_password": initial_password,
            })
            existing_emails.add(company_email)

    if errors:
        return {
            "success": False,
            "total_rows": len(rows),
            "valid_rows": len(validated_data),
            "error_rows": len(errors),
            "errors": errors,
            "message": f"Validation failed for {len(errors)} row(s). Correct the errors and try again."
        }

    # 3. Batch Create Records
    created_count = 0
    for item in validated_data:
        u = User(
            company_email=item["company_email"],
            full_name=item["full_name"],
            role=UserRole.INTERN,
            is_active=True,
            password_hash=hash_password(item["initial_password"]) if item["initial_password"] else None,
        )
        db.add(u)
        db.flush()

        prof = InternProfile(
            user_id=u.id,
            new_tk_id=item["new_tk_id"],
            department_id=item["department_id"],
            reporting_manager_id=item["reporting_manager_id"],
            category=item["category"],
            location=item["location"],
            internship_type=item["internship_type"],
            duration=item["duration"],
            joining_date=item["joining_date"],
            end_date=item["end_date"],
            remarks=item["remarks"],
            personal_email=item["personal_email"],
            personal_phone=item["personal_phone"],
            stipend_amount=item["stipend_amount"],
        )
        db.add(prof)
        created_count += 1

    log_action(db, str(current_user.id), AuditAction.USER_CREATED,
               metadata={"type": "bulk_import", "count": created_count})
    notify_admins(db, "👥 Bulk Intern Import Completed",
                  f"{created_count} new intern accounts were imported by {current_user.full_name}.",
                  "ACCOUNT_CREATED", "/admin/interns")
    db.commit()

    return {
        "success": True,
        "created_count": created_count,
        "message": f"Successfully imported {created_count} interns!"
    }
