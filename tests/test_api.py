import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.ind_client import IndClient
from app.main import app

PREFIX = ")]}',\n"


def ind_ok(data):
    return httpx.Response(200, text=PREFIX + json.dumps({"status": "OK", "data": data}))


@pytest.fixture
def make_client():
    def _make(handler):
        transport = httpx.MockTransport(handler)
        app.state.ind_client = IndClient(IndClient.create_http_client(transport=transport), retry_backoff_seconds=0)
        return TestClient(app)

    yield _make
    if hasattr(app.state, "ind_client"):
        del app.state.ind_client


def test_get_desks(make_client):
    seen = {}

    def handler(request: httpx.Request):
        seen["url"] = str(request.url)
        seen["headers"] = request.headers
        return ind_ok([{"key": "AM", "version": 1, "name": "Amsterdam"}])

    with make_client(handler) as client:
        res = client.post("/ind-api/rest", json={"action": "getDesks", "data": {"productType": "BIO"}})

    assert res.status_code == 200
    assert res.json() == [{"key": "AM", "version": 1, "name": "Amsterdam"}]
    assert seen["url"] == "https://oap.ind.nl/oap/api/desks/?productKey=BIO"
    assert seen["headers"]["oap-locale"] == "en"


def test_get_slots(make_client):
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        return ind_ok([])

    with make_client(handler) as client:
        res = client.post(
            "/ind-api/rest",
            json={"action": "getSlots", "data": {"productType": "BIO", "desk": "AM", "persons": "1"}},
        )

    assert res.status_code == 200
    assert seen["url"] == "https://oap.ind.nl/oap/api/desks/AM/slots?productKey=BIO&persons=1"


def test_block_and_reserve_slot(make_client):
    seen = []

    def handler(request):
        seen.append((request.method, str(request.url), json.loads(request.content)))
        return ind_ok({"ok": True})

    with make_client(handler) as client:
        client.post(
            "/ind-api/rest",
            json={"action": "blockSlot", "data": {"productType": "BIO", "desk": "AM", "payload": {"key": "abc"}}},
        )
        client.post("/ind-api/rest", json={"action": "reserveSlot", "data": {"desk": "AM", "payload": {"x": 1}}})

    assert seen == [
        ("POST", "https://oap.ind.nl/oap/api/desks/BIO/AM/slots/abc", {"key": "abc"}),
        ("POST", "https://oap.ind.nl/oap/api/desks/AM/appointments", {"x": 1}),
    ]


def test_unknown_action_returns_empty_list(make_client):
    with make_client(lambda r: ind_ok([])) as client:
        res = client.post("/ind-api/rest", json={"action": "nope", "data": {}})
    assert res.status_code == 200
    assert res.json() == []


def test_ind_error_returns_400(make_client):
    def handler(request):
        return httpx.Response(200, text=PREFIX + json.dumps({"status": "ERROR", "errorCode": "SLOT_TAKEN", "data": {"a": 1}}))

    with make_client(handler) as client:
        res = client.post("/ind-api/rest", json={"action": "getDesks", "data": {"productType": "BIO"}})

    assert res.status_code == 400
    assert res.json() == {"error": "SLOT_TAKEN", "code": "SLOT_TAKEN", "data": {"a": 1}}


def test_retries_connection_reset_then_succeeds(make_client):
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        if calls["n"] < 3:
            raise httpx.ReadError("Connection reset by peer", request=request)
        return ind_ok([])

    with make_client(handler) as client:
        res = client.post("/ind-api/rest", json={"action": "getDesks", "data": {"productType": "BIO"}})

    assert res.status_code == 200
    assert calls["n"] == 3


def test_gives_up_after_max_retries(make_client):
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        raise httpx.ReadError("Connection reset by peer", request=request)

    with make_client(handler) as client:
        res = client.post("/ind-api/rest", json={"action": "getDesks", "data": {"productType": "BIO"}})

    assert res.status_code == 400
    assert calls["n"] == 4


def test_missing_field_returns_400(make_client):
    with make_client(lambda r: ind_ok([])) as client:
        res = client.post("/ind-api/rest", json={"action": "getDesks", "data": {}})
    assert res.status_code == 400
    assert res.json() == {"error": "Missing field: productType"}
