from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from models.otp_challenge import OtpChallenge


class OtpRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, challenge: OtpChallenge) -> OtpChallenge:
        self.db.add(challenge)
        self.db.commit()
        self.db.refresh(challenge)
        return challenge

    def get_by_id(self, challenge_id: str) -> Optional[OtpChallenge]:
        return self.db.query(OtpChallenge).filter(OtpChallenge.id == challenge_id).first()

    def update_code(
        self,
        challenge_id: str,
        code_hash: str,
        expires_at: datetime,
    ) -> Optional[OtpChallenge]:
        ch = self.get_by_id(challenge_id)
        if not ch:
            return None
        ch.code_hash = code_hash
        ch.expires_at = expires_at
        ch.last_sent_at = datetime.now(timezone.utc)
        ch.attempts = 0
        self.db.commit()
        self.db.refresh(ch)
        return ch

    def increment_attempts(self, challenge_id: str) -> int:
        ch = self.get_by_id(challenge_id)
        if not ch:
            return -1
        ch.attempts += 1
        self.db.commit()
        return ch.attempts

    def delete(self, challenge_id: str) -> None:
        ch = self.get_by_id(challenge_id)
        if ch:
            self.db.delete(ch)
            self.db.commit()

    def purge_expired(self) -> int:
        """Best-effort cleanup of expired challenges. Idempotent."""
        now = datetime.now(timezone.utc)
        deleted = (
            self.db.query(OtpChallenge)
            .filter(OtpChallenge.expires_at < now)
            .delete(synchronize_session=False)
        )
        self.db.commit()
        return deleted
