from fastapi import APIRouter
from .auth import router as auth_router
from .companies import router as companies_router
from .workers import router as workers_router
from .billing import router as billing_router
from .licenses import router as licenses_router

router = APIRouter(prefix="/api/v1")
router.include_router(auth_router)
router.include_router(companies_router)
router.include_router(workers_router)
router.include_router(billing_router)
router.include_router(licenses_router)
