from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine
from .models import Base
from .api.v1.router import router

# DB テーブル自動作成（開発用）
Base.metadata.create_all(bind=engine)

app = FastAPI(title="PITBRAIN License Management API", version="1.0.0")

import os

_raw = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001")
_origins = [o.strip() for o in _raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok"}
