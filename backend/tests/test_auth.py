import jwt
from sqlalchemy import select

from app.auth.security import hash_password, verify_password
from app.config import get_settings
from app.models import User

CREDS = {"name": "Dia Demo", "email": "Dia@Example.com", "password": "correct-horse-battery"}


def test_password_hashing_is_salted_and_verifiable():
    h1, h2 = hash_password("s3cret-password"), hash_password("s3cret-password")
    assert h1 != h2 and "s3cret" not in h1
    assert verify_password("s3cret-password", h1) and not verify_password("wrong", h1)
    assert not verify_password("x", "not-a-hash")


def test_register_stores_hash_not_plaintext(client, db_session_factory):
    r = client.post("/api/auth/register", json=CREDS)
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["email"] == "dia@example.com" and "password" not in body["user"]
    with db_session_factory() as db:
        user = db.scalar(select(User))
        assert user.password_hash != CREDS["password"] and user.password_hash.startswith("$2")
        assert user.watchlist is not None and user.preferences is not None


def test_duplicate_email_rejected_case_insensitively(client):
    assert client.post("/api/auth/register", json=CREDS).status_code == 201
    r = client.post("/api/auth/register", json={**CREDS, "email": "dia@example.com"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "http_error"


def test_register_validation(client):
    assert client.post("/api/auth/register", json={**CREDS, "password": "short"}).status_code == 422
    assert client.post("/api/auth/register", json={**CREDS, "email": "nope"}).status_code == 422
    assert client.post("/api/auth/register", json={**CREDS, "password": "x" * 100}).status_code == 422
    r = client.post("/api/auth/register", json={**CREDS, "name": "   "})
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"


def test_login_success_and_failures(client):
    client.post("/api/auth/register", json=CREDS)
    ok = client.post("/api/auth/login", json={"email": "DIA@example.com", "password": CREDS["password"]})
    assert ok.status_code == 200 and ok.json()["token_type"] == "bearer"
    wrong = client.post("/api/auth/login", json={"email": "dia@example.com", "password": "nope-nope-nope"})
    unknown = client.post("/api/auth/login", json={"email": "who@example.com", "password": "nope-nope-nope"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["error"]["message"] == unknown.json()["error"]["message"]  # no user enumeration


def test_login_is_rate_limited(client):
    for _ in range(10):
        client.post("/api/auth/login", json={"email": "a@example.com", "password": "bad-password"})
    r = client.post("/api/auth/login", json={"email": "a@example.com", "password": "bad-password"})
    assert r.status_code == 429 and "Retry-After" in r.headers


def test_protected_routes_require_valid_token(client, auth_headers):
    assert client.get("/api/user/profile").status_code == 401
    assert client.get("/api/user/profile", headers={"Authorization": "Bearer garbage"}).status_code == 401
    r = client.get("/api/user/profile", headers=auth_headers)
    assert r.status_code == 200 and r.json()["user"]["name"] == "Dia Demo"
    assert client.get("/api/watchlist").status_code == 401


def test_expired_and_forged_tokens_are_rejected(client, auth_headers):
    settings = get_settings()
    expired = jwt.encode({"sub": "1", "exp": 1, "typ": "access"}, settings.jwt_secret, algorithm="HS256")
    forged = jwt.encode({"sub": "1", "exp": 9999999999, "typ": "access"}, "another-secret-another-secret-123", algorithm="HS256")
    wrong_type = jwt.encode({"sub": "1", "exp": 9999999999, "typ": "refresh"}, settings.jwt_secret, algorithm="HS256")
    for token in (expired, forged, wrong_type):
        assert client.get("/api/user/profile", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_preferences_roundtrip_and_validation(client, auth_headers):
    prefs = {"default_range": "1Y", "chart_type": "area", "indicators": ["sma50", "rsi", "sma50"]}
    r = client.put("/api/user/preferences", json=prefs, headers=auth_headers)
    assert r.status_code == 200 and r.json()["indicators"] == ["sma50", "rsi"]
    assert client.get("/api/user/profile", headers=auth_headers).json()["preferences"]["chart_type"] == "area"
    bad = client.put("/api/user/preferences", json={**prefs, "indicators": ["magic"]}, headers=auth_headers)
    assert bad.status_code == 422
