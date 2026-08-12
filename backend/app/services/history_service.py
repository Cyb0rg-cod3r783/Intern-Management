"""
History Service — Records structured career & lifecycle history for interns.
Automatically tracks:
- INTERNSHIP_EXTENSION (End date / duration changes)
- STIPEND_REVISION (Stipend amount / type changes - Sensitive)
- DEPARTMENT_TRANSFER (Department moves)
- MANAGER_CHANGE (Reporting manager moves)
- PROJECT_ASSIGNED / PROJECT_REMOVED (Project assignments)
- STATUS_CHANGE (Onboarding approval, active, alumni, inactive, rejected)
- TASK_COMPLETED (Task milestone achievements)
"""
import uuid
from datetime import datetime, date
from typing import Optional, Any
from sqlalchemy.orm import Session
from app.models import InternHistoryLog, InternProfile, User, Department
from app.models.enums import InternStatus


def record_history_log(
    db: Session,
    intern_profile_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
    event_type: str,
    title: str,
    description: Optional[str] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    metadata: Optional[dict] = None,
    performed_by_id: Optional[uuid.UUID | str] = None,
    is_sensitive: bool = False,
) -> InternHistoryLog:
    """Record a structured event log for an intern's career history."""
    log = InternHistoryLog(
        intern_profile_id=uuid.UUID(str(intern_profile_id)),
        user_id=uuid.UUID(str(user_id)),
        event_type=event_type,
        title=title,
        description=description,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        extra_metadata=metadata or {},
        performed_by_id=uuid.UUID(str(performed_by_id)) if performed_by_id else None,
        is_sensitive=is_sensitive,
        created_at=datetime.utcnow(),
    )
    db.add(log)
    db.flush()
    return log


def detect_and_record_profile_changes(
    db: Session,
    profile: InternProfile,
    old_data: dict,
    new_data: dict,
    performed_by: User,
) -> None:
    """
    Compare old profile attributes against new profile attributes and
    automatically insert history records for extensions, stipend revisions,
    department transfers, manager reassignments, and status transitions.
    """
    p_id = profile.id
    u_id = profile.user_id
    performed_by_id = performed_by.id
    performer_name = performed_by.full_name or "System Admin"

    # 1. Check Internship Extension (end_date or duration)
    old_end = old_data.get("end_date")
    new_end = new_data.get("end_date")
    old_dur = old_data.get("duration")
    new_dur = new_data.get("duration")

    if (new_end and old_end and new_end != old_end) or (new_dur and old_dur and new_dur != old_dur):
        # Count previous extensions
        ext_count = db.query(InternHistoryLog).filter(
            InternHistoryLog.user_id == u_id,
            InternHistoryLog.event_type == "INTERNSHIP_EXTENSION"
        ).count() + 1

        desc = f"Internship extended by {performer_name} (Extension #{ext_count})."
        if new_dur and old_dur and new_dur != old_dur:
            desc += f" Duration updated from '{old_dur}' to '{new_dur}'."

        record_history_log(
            db,
            intern_profile_id=p_id,
            user_id=u_id,
            event_type="INTERNSHIP_EXTENSION",
            title=f"Internship Extended (#{ext_count})",
            description=desc,
            old_value=str(old_end) if old_end else (old_dur or "—"),
            new_value=str(new_end) if new_end else (new_dur or "—"),
            metadata={
                "extension_number": ext_count,
                "old_end_date": str(old_end) if old_end else None,
                "new_end_date": str(new_end) if new_end else None,
                "old_duration": old_dur,
                "new_duration": new_dur,
            },
            performed_by_id=performed_by_id,
            is_sensitive=False,
        )

    # 2. Check Stipend Revision (stipend_amount or stipend_type or is_paid) - SENSITIVE
    old_stipend = old_data.get("stipend_amount")
    new_stipend = new_data.get("stipend_amount")
    old_stipend_type = old_data.get("stipend_type")
    new_stipend_type = new_data.get("stipend_type")

    if (new_stipend is not None and old_stipend != new_stipend) or (new_stipend_type and old_stipend_type != new_stipend_type):
        old_val_str = f"₹{float(old_stipend):,.2f}" if old_stipend is not None else "₹0.00"
        new_val_str = f"₹{float(new_stipend):,.2f}" if new_stipend is not None else "₹0.00"
        if old_stipend_type and new_stipend_type:
            old_val_str += f" ({old_stipend_type})"
            new_val_str += f" ({new_stipend_type})"

        is_increment = (float(new_stipend or 0) > float(old_stipend or 0)) if (old_stipend and new_stipend) else True
        title_text = "Stipend Increment" if is_increment else "Stipend Revision"

        record_history_log(
            db,
            intern_profile_id=p_id,
            user_id=u_id,
            event_type="STIPEND_REVISION",
            title=title_text,
            description=f"Stipend adjusted by {performer_name} from {old_val_str} to {new_val_str}.",
            old_value=old_val_str,
            new_value=new_val_str,
            metadata={
                "old_amount": float(old_stipend) if old_stipend is not None else 0.0,
                "new_amount": float(new_stipend) if new_stipend is not None else 0.0,
                "is_increment": is_increment,
            },
            performed_by_id=performed_by_id,
            is_sensitive=True,  # ADMIN ONLY
        )

    # 3. Check Department Transfer
    old_dept_id = old_data.get("department_id")
    new_dept_id = new_data.get("department_id")

    if new_dept_id and old_dept_id and str(new_dept_id) != str(old_dept_id):
        old_dept = db.query(Department).filter(Department.id == old_dept_id).first()
        new_dept = db.query(Department).filter(Department.id == new_dept_id).first()
        old_dept_name = old_dept.name if old_dept else "Unassigned"
        new_dept_name = new_dept.name if new_dept else "Unassigned"

        record_history_log(
            db,
            intern_profile_id=p_id,
            user_id=u_id,
            event_type="DEPARTMENT_TRANSFER",
            title="Department Transferred",
            description=f"Department changed from '{old_dept_name}' to '{new_dept_name}' by {performer_name}.",
            old_value=old_dept_name,
            new_value=new_dept_name,
            metadata={
                "old_department_id": str(old_dept_id),
                "new_department_id": str(new_dept_id),
            },
            performed_by_id=performed_by_id,
            is_sensitive=False,
        )

    # 4. Check Reporting Manager Change
    old_mgr_id = old_data.get("reporting_manager_id")
    new_mgr_id = new_data.get("reporting_manager_id")

    if new_mgr_id and old_mgr_id and str(new_mgr_id) != str(old_mgr_id):
        old_mgr = db.query(User).filter(User.id == old_mgr_id).first()
        new_mgr = db.query(User).filter(User.id == new_mgr_id).first()
        old_mgr_name = old_mgr.full_name if old_mgr else "None"
        new_mgr_name = new_mgr.full_name if new_mgr else "None"

        record_history_log(
            db,
            intern_profile_id=p_id,
            user_id=u_id,
            event_type="MANAGER_CHANGE",
            title="Reporting Manager Changed",
            description=f"Reporting manager updated from '{old_mgr_name}' to '{new_mgr_name}' by {performer_name}.",
            old_value=old_mgr_name,
            new_value=new_mgr_name,
            metadata={
                "old_manager_id": str(old_mgr_id),
                "new_manager_id": str(new_mgr_id),
            },
            performed_by_id=performed_by_id,
            is_sensitive=False,
        )

    # 5. Check Status Change
    old_status = old_data.get("status")
    new_status = new_data.get("status")

    if new_status and old_status and new_status != old_status:
        old_status_val = old_status.value if isinstance(old_status, InternStatus) else str(old_status)
        new_status_val = new_status.value if isinstance(new_status, InternStatus) else str(new_status)

        record_history_log(
            db,
            intern_profile_id=p_id,
            user_id=u_id,
            event_type="STATUS_CHANGE",
            title="Status Changed",
            description=f"Intern status changed from '{old_status_val}' to '{new_status_val}' by {performer_name}.",
            old_value=old_status_val,
            new_value=new_status_val,
            metadata={
                "old_status": old_status_val,
                "new_status": new_status_val,
            },
            performed_by_id=performed_by_id,
            is_sensitive=False,
        )

    # 6. Check Promotion (category change e.g. intern -> trainee -> contract -> full_time)
    old_cat = old_data.get("category")
    new_cat = new_data.get("category")

    if new_cat and old_cat and old_cat.lower() != new_cat.lower():
        old_type = old_data.get("internship_type", "paid")
        new_type = new_data.get("internship_type", "paid")
        old_stipend = old_data.get("stipend_amount")
        new_stipend = new_data.get("stipend_amount")

        old_desc = f"{old_cat.upper()} ({old_type.upper()})"
        new_desc = f"{new_cat.upper()} ({new_type.upper()}"
        if new_stipend and float(new_stipend) > 0:
            new_desc += f" ₹{float(new_stipend):,.2f}"
        new_desc += ")"

        record_history_log(
            db,
            intern_profile_id=p_id,
            user_id=u_id,
            event_type="PROMOTION",
            title=f"Promoted to {new_cat.replace('_', ' ').title()}",
            description=f"Candidate promoted from {old_desc} to {new_desc} by {performer_name}.",
            old_value=old_desc,
            new_value=new_desc,
            metadata={
                "old_category": old_cat,
                "new_category": new_cat,
                "old_type": old_type,
                "new_type": new_type,
            },
            performed_by_id=performed_by_id,
            is_sensitive=False,
        )
