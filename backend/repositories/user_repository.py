from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from dtos.user import UserCreate
from models.user import User


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    def get_user_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email).first()

    def get_user_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter(User.username == username).first()

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_all_users(self) -> list[User]:
        return self.db.query(User).all()

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    def create_user(self, user: UserCreate, hashed_password: str) -> User:
        db_user = User(
            username=user.username,
            email=user.email,
            hashed_password=hashed_password,
            role="staff",  # role is always staff at creation; admin promotes separately
        )
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    def create_admin(
        self,
        *,
        username: str,
        email: str,
        hashed_password: str,
        allowed_category_ids: list[int],
        role: str = "admin",
        is_active: bool = True,
    ) -> User:
        """
        Create a privileged user (admin or super_admin).

        super_admin has no category scope by definition — `allowed_category_ids`
        is ignored when role is super_admin so the caller doesn't have to
        remember to clear the field.
        """
        from models.catalog import Category

        db_user = User(
            username=username,
            email=email,
            hashed_password=hashed_password,
            role=role,
            is_active=is_active,
        )
        if role == "admin" and allowed_category_ids:
            cats = (
                self.db.query(Category)
                .filter(Category.id.in_(allowed_category_ids))
                .all()
            )
            db_user.allowed_categories.extend(cats)
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    def set_allowed_categories(self, user_id: int, category_ids: list[int]) -> Optional[User]:
        from models.catalog import Category

        user = self.get_user_by_id(user_id)
        if not user:
            return None
        user.allowed_categories.clear()
        if category_ids:
            cats = (
                self.db.query(Category)
                .filter(Category.id.in_(category_ids))
                .all()
            )
            user.allowed_categories.extend(cats)
        self.db.commit()
        self.db.refresh(user)
        return user

    def list_admins(self) -> list[User]:
        """List every privileged user — both admins and super_admins."""
        return (
            self.db.query(User)
            .filter(User.role.in_(("admin", "super_admin")))
            .order_by(User.role.desc(), User.id)
            .all()
        )

    # ------------------------------------------------------------------
    # Update (general — pass only the fields you want to change)
    # ------------------------------------------------------------------

    def update_user(self, user_id: int, fields: dict) -> Optional[User]:
        user = self.get_user_by_id(user_id)
        if not user:
            return None
        for key, value in fields.items():
            setattr(user, key, value)
        self.db.commit()
        self.db.refresh(user)
        return user

    def set_role(self, user_id: int, role: str) -> Optional[User]:
        return self.update_user(user_id, {"role": role})

    def set_active(self, user_id: int, is_active: bool) -> Optional[User]:
        return self.update_user(user_id, {"is_active": is_active})

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    def delete_user(self, user_id: int) -> bool:
        user = self.get_user_by_id(user_id)
        if not user:
            return False
        self.db.delete(user)
        self.db.commit()
        return True

    # ------------------------------------------------------------------
    # Brute-force protection helpers
    # ------------------------------------------------------------------

    def update_failed_attempts(self, user_id: int, attempts: int) -> None:
        self.db.query(User).filter(User.id == user_id).update(
            {"failed_login_attempts": attempts}
        )
        self.db.commit()

    def lock_user(self, user_id: int, locked_until: datetime, reset_attempts: int = 0) -> None:
        self.db.query(User).filter(User.id == user_id).update(
            {"locked_until": locked_until, "failed_login_attempts": reset_attempts}
        )
        self.db.commit()
