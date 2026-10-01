import asyncio
import json
import logging
import time
from typing import Any, Literal

import httpx

IND_HOST = "https://oap.ind.nl/oap/api/desks"
TIMEOUT_SECONDS = 15.0
MAX_RETRIES = 3
RESPONSE_PREFIX = ")]}',\n"

logger = logging.getLogger("ind_client")

RETRYABLE_ERRORS = (
    httpx.ConnectError,
    httpx.ReadError,
    httpx.WriteError,
    httpx.RemoteProtocolError,
    httpx.TimeoutException,
)


class IndApiError(Exception):
    def __init__(self, message: str, code: str | None = None, data: Any = None):
        super().__init__(message)
        self.code = code
        self.data = data


def _error_chain(error: BaseException) -> list[dict[str, Any]]:
    chain: list[dict[str, Any]] = []
    current: BaseException | None = error
    while current is not None and len(chain) < 5:
        item: dict[str, Any] = {"type": type(current).__name__, "message": str(current)}
        errno = getattr(current, "errno", None)
        if errno is not None:
            item["errno"] = errno
        chain.append(item)
        current = current.__cause__ or current.__context__
    return chain


def parse_ind_response(text: str) -> Any:
    if text.startswith(RESPONSE_PREFIX):
        text = text[len(RESPONSE_PREFIX) :]
    parsed = json.loads(text)

    if parsed.get("status") != "OK":
        raw_message = parsed.get("errorCode") or parsed.get("error") or "Unknown error"
        message = raw_message if isinstance(raw_message, str) else json.dumps(raw_message)
        raise IndApiError(message, code=parsed.get("errorCode"), data=parsed.get("data"))

    return parsed.get("data")


class IndClient:
    def __init__(self, http_client: httpx.AsyncClient, retry_backoff_seconds: float = 1.0):
        self._http = http_client
        self._backoff = retry_backoff_seconds

    @staticmethod
    def create_http_client(**kwargs: Any) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            timeout=TIMEOUT_SECONDS,
            headers={"Accept": "application/json", "oap-locale": "en"},
            **kwargs,
        )

    async def _request(
        self,
        method: Literal["GET", "POST"],
        path: str,
        params: dict[str, str] | None = None,
        body: Any = None,
    ) -> Any:
        url = f"{IND_HOST}/{path}"
        log_context = {"method": method, "host": httpx.URL(url).host, "path": httpx.URL(url).path, "query": params or {}}

        for attempt in range(MAX_RETRIES + 1):
            started = time.monotonic()
            status: int | None = None
            response_text: str | None = None
            try:
                response = await self._http.request(method, url, params=params, json=body)
                status = response.status_code
                response_text = response.text
                data = parse_ind_response(response_text)
                logger.info(
                    "IND request succeeded",
                    extra={**log_context, "status": status, "attempt": attempt + 1, "durationMs": _elapsed_ms(started)},
                )
                return data
            except Exception as error:
                retryable = isinstance(error, RETRYABLE_ERRORS)
                should_retry = retryable and attempt < MAX_RETRIES
                delay = self._backoff * (2**attempt)
                logger.error(
                    "IND request failed",
                    extra={
                        **log_context,
                        "status": status,
                        "responseBodySnippet": response_text[:500] if response_text else None,
                        "durationMs": _elapsed_ms(started),
                        "attempt": attempt + 1,
                        "maxAttempts": MAX_RETRIES + 1,
                        "retryable": retryable,
                        "retryDelayMs": int(delay * 1000) if should_retry else None,
                        "error": _error_chain(error),
                    },
                )
                if not should_retry:
                    raise
                await asyncio.sleep(delay)

        raise RuntimeError("Retry failed")

    async def get_desks(self, product_type: str) -> Any:
        return await self._request("GET", "", params={"productKey": product_type})

    async def get_slots(self, product_type: str, desk: str, persons: str) -> Any:
        return await self._request(
            "GET", f"{desk}/slots", params={"productKey": product_type, "persons": str(persons)}
        )

    async def block_slot(self, product_type: str, desk: str, payload: dict[str, Any]) -> Any:
        return await self._request("POST", f"{product_type}/{desk}/slots/{payload['key']}", body=payload)

    async def reserve_slot(self, desk: str, payload: Any) -> Any:
        return await self._request("POST", f"{desk}/appointments", body=payload)


def _elapsed_ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)
