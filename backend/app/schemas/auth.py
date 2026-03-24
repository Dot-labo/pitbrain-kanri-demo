from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PasswordSetRequest(BaseModel):
    token: str
    new_password: str


class PasswordResetRequest(BaseModel):
    email: EmailStr
