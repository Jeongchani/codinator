import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v2.router import api_router
from app.core.config import AI_CORS_ALLOW_ORIGINS, AI_ENV
from app.core.errors import AppError, build_error_response

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    force=True,
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Codinator AI API",
    description="얼굴 검출 및 얼굴 블러 처리 API",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=AI_CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v2")


@app.get("/")
def root():
    return {
        "success": True,
        "message": "Codinator AI API is running.",
        "docs": "/docs",
        "health": "/api/v2/health",
    }


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    started_at = time.perf_counter()

    try:
        response = await call_next(request)
    except Exception:
        logger.exception("request_id=%s unhandled exception path=%s", request_id, request.url.path)
        raise

    duration_ms = int((time.perf_counter() - started_at) * 1000)
    response.headers["X-Request-ID"] = request_id

    logger.info(
        "request_id=%s method=%s path=%s status=%s duration_ms=%s env=%s",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        AI_ENV,
    )
    return response


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content=build_error_response(
            code=exc.code,
            message=exc.message,
            details=exc.details,
        ),
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=build_error_response(
            code="INVALID_REQUEST",
            message="요청 형식이 올바르지 않습니다.",
            details={"errors": exc.errors()},
        ),
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", None)
    logger.exception("request_id=%s unexpected server error", request_id)

    return JSONResponse(
        status_code=500,
        content=build_error_response(
            code="INTERNAL_SERVER_ERROR",
            message="서버 내부 오류가 발생했습니다.",
        ),
    )
