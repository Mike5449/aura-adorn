from core.exceptions import ForbiddenException, NotFoundException, UserAlreadyExistsException

from core.security import get_password_hash
from dtos.user import UserAdminUpdate, UserCreate, UserSelfUpdate
from repositories.user_repository import UserRepository



class UserService:
    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    def create_new_user(self, user: UserCreate):
        if self.user_repository.get_user_by_email(email=user.email):
            raise UserAlreadyExistsException(detail="Email already registered")
        if self.user_repository.get_user_by_username(username=user.username):
            raise UserAlreadyExistsException(detail="Username already taken")
        hashed_password = get_password_hash(user.password)
        return self.user_repository.create_user(user=user, hashed_password=hashed_password)

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def get_all_users(self):
        return self.user_repository.get_all_users()

    def get_user_by_id(self, user_id: int):
        user = self.user_repository.get_user_by_id(user_id)
        if not user:
            raise NotFoundException(detail=f"User {user_id} not found")
        return user

    # ------------------------------------------------------------------
    # Self-update (own profile — no role/status changes allowed)
    # ------------------------------------------------------------------

    def update_self(self, current_user_id: int, data: UserSelfUpdate):
        fields = {}
        if data.email is not None:
            existing = self.user_repository.get_user_by_email(data.email)
            if existing and existing.id != current_user_id:
                raise UserAlreadyExistsException(detail="Email already in use")
            fields["email"] = data.email
        if data.password is not None:
            fields["hashed_password"] = get_password_hash(data.password)
        if not fields:
            return self.user_repository.get_user_by_id(current_user_id)
        user = self.user_repository.update_user(current_user_id, fields)
        if not user:
            raise NotFoundException(detail="User not found")
        return user

    # ------------------------------------------------------------------
    # Admin update (any field on any user)
    # ------------------------------------------------------------------

    def admin_update_user(self, user_id: int, data: UserAdminUpdate):
        target = self.user_repository.get_user_by_id(user_id)
        if not target:
            raise NotFoundException(detail=f"User {user_id} not found")

        fields = {}
        if data.email is not None:
            existing = self.user_repository.get_user_by_email(data.email)
            if existing and existing.id != user_id:
                raise UserAlreadyExistsException(detail="Email already in use")
            fields["email"] = data.email
        if data.password is not None:
            fields["hashed_password"] = get_password_hash(data.password)
        if data.role is not None:
            fields["role"] = data.role
        if data.is_active is not None:
            fields["is_active"] = data.is_active

        if not fields:
            return target
        return self.user_repository.update_user(user_id, fields)

    # ------------------------------------------------------------------
    # Admin dedicated actions
    # ------------------------------------------------------------------

    def change_role(self, user_id: int, role: str, requesting_user_id: int):
        if user_id == requesting_user_id:
            raise ForbiddenException(detail="Admins cannot change their own role")
        target = self.user_repository.get_user_by_id(user_id)
        if not target:
            raise NotFoundException(detail=f"User {user_id} not found")
        result = self.user_repository.set_role(user_id, role)
        return result

    def change_status(self, user_id: int, is_active: bool, requesting_user_id: int):
        if user_id == requesting_user_id:
            raise ForbiddenException(detail="Admins cannot deactivate their own account")
        target = self.user_repository.get_user_by_id(user_id)
        if not target:
            raise NotFoundException(detail=f"User {user_id} not found")
        return self.user_repository.set_active(user_id, is_active)

    def delete_user(self, user_id: int, requesting_user_id: int):
        if user_id == requesting_user_id:
            raise ForbiddenException(detail="Admins cannot delete their own account")
        target = self.user_repository.get_user_by_id(user_id)
        if not target:
            raise NotFoundException(detail=f"User {user_id} not found")
        self.user_repository.delete_user(user_id)
