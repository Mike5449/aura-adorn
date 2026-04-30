from typing import Optional, Union
from pydantic import BaseModel, Field


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class OtpChallengeResponse(BaseModel):
    """Returned when an admin/super_admin logs in with valid credentials —
    the JWT tokens are NOT issued yet, the user must verify the 6-digit
    code emailed to them at /token/verify-otp."""
    otp_required: bool = True
    challenge_id: str
    email_hint: str
    expires_in_seconds: int


# /token can either return tokens (regular user) OR an OTP challenge
# (privileged user). The shape is discriminated by the `otp_required` field
# on the OTP variant; clients check that first.
LoginResponse = Union[OtpChallengeResponse, Token]


class AccessToken(BaseModel):
    access_token: str
    token_type: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class OtpVerifyRequest(BaseModel):
    challenge_id: str = Field(min_length=8, max_length=128)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class OtpResendRequest(BaseModel):
    challenge_id: str = Field(min_length=8, max_length=128)


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None
    permissions: list[str] = []
