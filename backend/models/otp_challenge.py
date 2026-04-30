from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from database import Base


class OtpChallenge(Base):
    """
    A pending second-factor challenge — created right after a successful
    password check, consumed when the user enters the 6-digit code that
    was emailed to them.

    `id` is an opaque random token returned to the browser; it ties the
    code-entry attempt back to the user without exposing the user_id.
    `code_hash` is bcrypt-hashed so a leaked database row cannot be used
    to log in.
    """
    __tablename__ = "otp_challenges"

    id = Column(String(64), primary_key=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    last_sent_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
