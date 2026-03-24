import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import AdminUser, PasswordResetToken
from ...core.security import verify_password, hash_password, create_access_token
from ...schemas.auth import LoginRequest, TokenResponse, PasswordResetRequest, PasswordSetRequest
from ..deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(AdminUser).filter(AdminUser.email == body.email).first()
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="メールアドレスまたはパスワードが違います")
    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="アカウントが無効です")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@router.post("/password-reset/request")
def request_password_reset(body: PasswordResetRequest, db: Session = Depends(get_db)):
    user = db.query(AdminUser).filter(AdminUser.email == body.email).first()
    if not user:
        # セキュリティのため存在しなくても同じレスポンス
        return {"message": "リセットメールを送信しました（登録済みの場合）"}

    token_str = secrets.token_urlsafe(32)
    reset_token = PasswordResetToken(
        admin_user_id=user.id,
        token=token_str,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(reset_token)
    db.commit()

    # TODO: メール送信実装
    return {"message": "リセットメールを送信しました（登録済みの場合）"}


@router.post("/password-reset/confirm")
def confirm_password_reset(body: PasswordSetRequest, db: Session = Depends(get_db)):
    reset_token = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token == body.token,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if not reset_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="無効または期限切れのトークンです")

    user = db.get(AdminUser, reset_token.admin_user_id)
    user.password_hash = hash_password(body.new_password)
    if user.status == "pending":
        user.status = "active"
        user.activated_at = datetime.now(timezone.utc)

    reset_token.used_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "パスワードを設定しました"}


@router.get("/me")
def get_me(current_user: AdminUser = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "company_id": current_user.company_id,
        "company_name": current_user.company.company_name,
        "company_code": current_user.company.company_code,
        "level": current_user.company.level,
    }
