import enum


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    INTERN = "INTERN"


class InternStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ALUMNI = "ALUMNI"
    INACTIVE = "INACTIVE"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    REJECTED_BY_MANAGER = "REJECTED_BY_MANAGER"


class TaskStatus(str, enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    COMPLETED = "COMPLETED"
    # OVERDUE is computed at query time, NOT stored


class TaskPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class TaskApprovalStatus(str, enum.Enum):
    """
    APPROVED: task is live — the default for anything an Admin/Manager creates
    directly (no approval step needed).
    PENDING: an Intern self-assigned this task under a project and it's
    awaiting their reporting Manager's (or an Admin's) sign-off.
    REJECTED: a Manager/Admin declined the intern's self-assigned task.
    """
    APPROVED = "APPROVED"
    PENDING = "PENDING"
    REJECTED = "REJECTED"


class HandoverStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    COMPLETED = "COMPLETED"


class AuditAction(str, enum.Enum):
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    VIEW_PROFILE = "VIEW_PROFILE"
    VIEW_SENSITIVE_PROFILE = "VIEW_SENSITIVE_PROFILE"
    CREATE_INTERN = "CREATE_INTERN"
    EDIT_INTERN = "EDIT_INTERN"
    EDIT_STIPEND = "EDIT_STIPEND"
    VIEW_BANK_INFORMATION = "VIEW_BANK_INFORMATION"
    EXPORT_DATA = "EXPORT_DATA"
    CREATE_TASK = "CREATE_TASK"
    UPDATE_TASK = "UPDATE_TASK"
    CREATE_HANDOVER = "CREATE_HANDOVER"
    UPDATE_HANDOVER = "UPDATE_HANDOVER"
    ACKNOWLEDGE_HANDOVER = "ACKNOWLEDGE_HANDOVER"
    DEACTIVATE_USER = "DEACTIVATE_USER"
    CREATE_DEPARTMENT = "CREATE_DEPARTMENT"
    UPDATE_DEPARTMENT = "UPDATE_DEPARTMENT"
    USER_CREATED = "USER_CREATED"
    USER_DELETED = "USER_DELETED"
    PASSWORD_CHANGED = "PASSWORD_CHANGED"
    APPROVE_INTERN = "APPROVE_INTERN"
    REJECT_INTERN = "REJECT_INTERN"
    TRANSFER_REQUEST = "TRANSFER_REQUEST"
    CREATE_PROJECT = "CREATE_PROJECT"
    UPDATE_PROJECT = "UPDATE_PROJECT"
    DELETE_PROJECT = "DELETE_PROJECT"
    UPDATE_USER = "UPDATE_USER"
    APPROVE_TASK = "APPROVE_TASK"
    REJECT_TASK = "REJECT_TASK"
