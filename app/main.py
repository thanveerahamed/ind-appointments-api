import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.ind_client import IndClient
from app.logging_config import configure_logging

configure_logging()
logger = logging.getLogger("ind_api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tests may inject their own client before startup.
    owned_http_client = None
    if not hasattr(app.state, "ind_client"):
        owned_http_client = IndClient.create_http_client()
        app.state.ind_client = IndClient(owned_http_client)
    logger.info("Server started")
    yield
    if owned_http_client is not None:
        await owned_http_client.aclose()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


class RestRequest(BaseModel):
    action: str | None = None
    data: dict[str, Any] | None = None


@app.get("/_ah/warmup", include_in_schema=False)
async def warmup() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ind-api/rest")
async def rest(body: RestRequest, request: Request):
    client: IndClient = request.app.state.ind_client
    data = body.data or {}

    try:
        match body.action:
            case "getDesks":
                result = await client.get_desks(data["productType"])
            case "getSlots":
                result = await client.get_slots(data["productType"], data["desk"], data["persons"])
            case "blockSlot":
                result = await client.block_slot(data["productType"], data["desk"], data["payload"])
            case "reserveSlot":
                result = await client.reserve_slot(data["desk"], data["payload"])
            case _:
                result = []
        return result
    except KeyError as error:
        return _error_response(body.action, data, ValueError(f"Missing field: {error.args[0]}"))
    except Exception as error:
        return _error_response(body.action, data, error)


def _error_response(action: str | None, data: dict[str, Any], error: Exception) -> JSONResponse:
    # Request data is deliberately not logged in full: reserveSlot payloads contain personal details.
    logger.error(
        f"Action {action} failed",
        extra={
            "action": action,
            "productType": data.get("productType"),
            "desk": data.get("desk"),
            "errorType": type(error).__name__,
            "errorMessage": str(error),
            "errorCode": getattr(error, "code", None),
        },
    )
    content: dict[str, Any] = {"error": str(error) or "Unknown error"}
    if getattr(error, "code", None) is not None:
        content["code"] = error.code
    if getattr(error, "data", None) is not None:
        content["data"] = error.data
    return JSONResponse(status_code=400, content=content)
