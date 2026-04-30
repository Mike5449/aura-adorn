from pydantic import BaseModel, EmailStr, Field


class ContactMessageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    message: str = Field(min_length=1, max_length=2000)
    # Honeypot — legitimate visitors leave this empty; bots fill every field.
    # The field name is intentionally generic to look tempting.
    website: str = Field(default="", max_length=200)
