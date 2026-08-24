import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.database.models import Base
from app.database.session import close_db_engine, get_engine, init_db
from app.main import app


@pytest_asyncio.fixture(autouse=True)
async def setup_and_teardown_db():
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await close_db_engine()


@pytest.mark.asyncio
async def test_register_and_login_flow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Register candidate
        reg_payload = {
            "full_name": "Jane Doe",
            "email": "jane@example.com",
            "password": "SecurePassword123!",
        }
        res_reg = await client.post("/auth/register", json=reg_payload)
        assert res_reg.status_code == 201
        data_reg = res_reg.json()
        assert "access_token" in data_reg
        assert data_reg["user"]["email"] == "jane@example.com"
        assert data_reg["user"]["full_name"] == "Jane Doe"
        token = data_reg["access_token"]

        # 2. Get /auth/me with Bearer token
        res_me = await client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_me.status_code == 200
        data_me = res_me.json()
        assert data_me["email"] == "jane@example.com"

        # 3. Duplicate registration should fail
        res_dup = await client.post("/auth/register", json=reg_payload)
        assert res_dup.status_code == 400
        assert "already exists" in res_dup.json()["detail"].lower()

        # 4. Login with correct credentials
        login_payload = {
            "email": "JANE@EXAMPLE.COM ",  # Test case-insensitivity & trimming
            "password": "SecurePassword123!",
        }
        res_login = await client.post("/auth/login", json=login_payload)
        assert res_login.status_code == 200
        assert "access_token" in res_login.json()

        # 5. Login with wrong password
        res_bad_pw = await client.post(
            "/auth/login",
            json={"email": "jane@example.com", "password": "WrongPassword!"},
        )
        assert res_bad_pw.status_code == 401

        # 6. Logout endpoint should clear session
        res_logout = await client.post("/auth/logout")
        assert res_logout.status_code == 200

    # 7. Unauthenticated /auth/me on fresh client without cookies or token should fail with 401
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as fresh_client:
        res_unauth = await fresh_client.get("/auth/me")
        assert res_unauth.status_code == 401


@pytest.mark.asyncio
async def test_auth_validation_edge_cases():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Invalid email format
        res1 = await client.post(
            "/auth/register",
            json={"full_name": "Bob", "email": "not-an-email", "password": "Password123!"},
        )
        assert res1.status_code == 422

        # Password too short (<8 chars)
        res2 = await client.post(
            "/auth/register",
            json={"full_name": "Bob", "email": "bob@example.com", "password": "short"},
        )
        assert res2.status_code == 422

        # Name too short
        res3 = await client.post(
            "/auth/register",
            json={"full_name": "A", "email": "bob@example.com", "password": "Password123!"},
        )
        assert res3.status_code == 422
