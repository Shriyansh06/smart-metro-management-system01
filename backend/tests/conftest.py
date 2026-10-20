import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("METRO_DB", str(tmp_path / "test.sqlite3"))
    with TestClient(app) as test_client:
        yield test_client


def sign_in(client, admin=False):
    email, password = (
        ("admin@metro.local", "Admin123!")
        if admin
        else ("passenger@metro.local", "Passenger123!")
    )
    response = client.post(
        "/api/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["token"]}


@pytest.fixture
def admin(client):
    return sign_in(client, True)


@pytest.fixture
def passenger(client):
    return sign_in(client)
