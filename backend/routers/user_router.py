from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.rbac import Permission, require_permission
from core.security import get_current_active_user
from database import get_db
from dtos.user import (
    AdminAllowedCategoriesUpdate,
    AdminCommissionUpdate,
    AdminCreate,
    UserAdminUpdate,
    UserCreate,
    UserResponse,
    UserRoleUpdate,
    UserSelfUpdate,
    UserStatusUpdate,
)
from repositories.user_repository import UserRepository
from services.user_service import UserService

router = APIRouter(
    prefix="/users",
    tags=["users"],
)

_401 = {"description": "Not authenticated"}
_403 = {"description": "Insufficient permissions"}
_404 = {"description": "User not found"}
_409 = {"description": "Email or username already taken"}


def get_user_service(db: Session = Depends(get_db)) -> UserService:
    return UserService(UserRepository(db))


# ---------------------------------------------------------------------------
# Admin management — must be declared BEFORE /{user_id} so FastAPI doesn't
# greedily match "admins" as an integer user id (which would 422).
# super_admin only.
# ---------------------------------------------------------------------------

@router.post(
    "/admins",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a scoped admin user (super_admin only)",
    description=(
        "**Permission required:** `users:create`\n\n"
        "Creates an admin who can manage products inside the listed "
        "`allowed_category_ids`. Pass leaf-category ids."
    ),
    responses={401: _401, 403: _403, 409: _409},
    dependencies=[Depends(require_permission(Permission.USERS_CREATE))],
)
def create_admin(
    data: AdminCreate,
    service: UserService = Depends(get_user_service),
):
    return service.create_admin(data)


@router.get(
    "/admins",
    response_model=list[UserResponse],
    summary="List admin users (super_admin)",
    dependencies=[Depends(require_permission(Permission.USERS_LIST))],
)
def list_admins(service: UserService = Depends(get_user_service)):
    return service.list_admins()


# ---------------------------------------------------------------------------
# Own profile — available to every authenticated user
# ---------------------------------------------------------------------------

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get own profile",
    description="Returns the profile of the currently authenticated user. No special permission required.",
    responses={401: _401},
)
def get_me(current_user=Depends(get_current_active_user)):
    return current_user


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Update own profile",
    description=(
        "Allows any authenticated user to update their own **email** and/or **password**.\n\n"
        "- Cannot change role or active status (admin-only operations).\n"
        "- Password must meet strength requirements."
    ),
    responses={401: _401, 409: _409},
)
def update_me(
    data: UserSelfUpdate,
    current_user=Depends(get_current_active_user),
    service: UserService = Depends(get_user_service),
):
    return service.update_self(current_user.id, data)


# ---------------------------------------------------------------------------
# Admin / manager endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user",
    description=(
        "**Permission required:** `users:create` (admin only)\n\n"
        "Creates a new user account. The new account is always assigned the `staff` role — "
        "use `PATCH /users/{id}/role` to promote afterwards."
    ),
    responses={201: {"description": "User created"}, 401: _401, 403: _403, 409: _409},
    dependencies=[Depends(require_permission(Permission.USERS_CREATE))],
)
def create_user(
    user: UserCreate,
    service: UserService = Depends(get_user_service),
):
    return service.create_new_user(user=user)


@router.get(
    "/",
    response_model=list[UserResponse],
    summary="List all users",
    description="**Permission required:** `users:list` (admin, manager)",
    responses={401: _401, 403: _403},
    dependencies=[Depends(require_permission(Permission.USERS_LIST))],
)
def list_users(service: UserService = Depends(get_user_service)):
    return service.get_all_users()


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get a user by ID",
    description="**Permission required:** `users:read` (admin, manager)",
    responses={401: _401, 403: _403, 404: _404},
    dependencies=[Depends(require_permission(Permission.USERS_READ))],
)
def get_user(user_id: int, service: UserService = Depends(get_user_service)):
    return service.get_user_by_id(user_id)


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Admin update — any field on any user",
    description=(
        "**Permission required:** `users:update` (admin only)\n\n"
        "Can update email, password, role, and active status in a single call."
    ),
    responses={401: _401, 403: _403, 404: _404, 409: _409},
    dependencies=[Depends(require_permission(Permission.USERS_UPDATE))],
)
def admin_update_user(
    user_id: int,
    data: UserAdminUpdate,
    service: UserService = Depends(get_user_service),
):
    return service.admin_update_user(user_id, data)


@router.patch(
    "/{user_id}/role",
    response_model=UserResponse,
    summary="Change a user's role",
    description=(
        "**Permission required:** `users:change_role` (admin only)\n\n"
        "Valid roles: `admin`, `manager`, `staff`.\n\n"
        "An admin cannot change their own role."
    ),
    responses={401: _401, 403: _403, 404: _404},
)
def change_role(
    user_id: int,
    data: UserRoleUpdate,
    current_user=Depends(require_permission(Permission.USERS_CHANGE_ROLE)),
    service: UserService = Depends(get_user_service),
):
    return service.change_role(user_id, data.role, requesting_user_id=current_user.id)


@router.patch(
    "/{user_id}/status",
    response_model=UserResponse,
    summary="Activate or deactivate a user",
    description=(
        "**Permission required:** `users:deactivate` (admin only)\n\n"
        "Set `is_active: false` to block a user from logging in without deleting their account.\n\n"
        "An admin cannot deactivate their own account."
    ),
    responses={401: _401, 403: _403, 404: _404},
)
def change_status(
    user_id: int,
    data: UserStatusUpdate,
    current_user=Depends(require_permission(Permission.USERS_DEACTIVATE)),
    service: UserService = Depends(get_user_service),
):
    return service.change_status(user_id, data.is_active, requesting_user_id=current_user.id)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a user",
    description=(
        "**Permission required:** `users:delete` (super_admin only)\n\n"
        "Permanently deletes the user record. This action is **irreversible**.\n\n"
        "A user cannot delete their own account."
    ),
    responses={204: {"description": "User deleted"}, 401: _401, 403: _403, 404: _404},
)
def delete_user(
    user_id: int,
    current_user=Depends(require_permission(Permission.USERS_DELETE)),
    service: UserService = Depends(get_user_service),
):
    service.delete_user(user_id, requesting_user_id=current_user.id)


# ---------------------------------------------------------------------------
# allowed_categories — modifying scope for an existing admin
# ---------------------------------------------------------------------------

@router.patch(
    "/{user_id}/allowed-categories",
    response_model=UserResponse,
    summary="Replace the set of allowed categories for an admin (super_admin)",
    responses={401: _401, 403: _403, 404: _404},
    dependencies=[Depends(require_permission(Permission.USERS_UPDATE))],
)
def update_allowed_categories(
    user_id: int,
    data: AdminAllowedCategoriesUpdate,
    service: UserService = Depends(get_user_service),
):
    return service.set_allowed_categories(user_id, data.allowed_category_ids)


@router.patch(
    "/{user_id}/commission",
    response_model=UserResponse,
    summary="Update the platform commission % for an admin (super_admin)",
    description=(
        "Sets the percentage of each paid order's order-items owned by this "
        "admin that the platform (super_admin) collects. Range: 0–100. "
        "Only meaningful for users with role admin or super_admin."
    ),
    responses={401: _401, 403: _403, 404: _404},
    dependencies=[Depends(require_permission(Permission.USERS_UPDATE))],
)
def update_commission(
    user_id: int,
    data: AdminCommissionUpdate,
    service: UserService = Depends(get_user_service),
):
    return service.set_commission_pct(user_id, float(data.commission_pct))
