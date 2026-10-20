from concurrent.futures import ThreadPoolExecutor


def test_route_and_incident_rerouting(client, admin):
    route = client.get("/api/routes?origin=1&destination=5").json()
    assert route["path"] == [1, 2, 3, 4, 5]
    assert route["minutes"] == 19
    assert (
        client.post(
            "/api/incidents",
            headers=admin,
            json={"station_id": 3, "title": "Signal failure", "severity": 5},
        ).status_code
        == 201
    )
    reroute = client.get("/api/routes?origin=1&destination=5").json()
    assert reroute["path"] == [1, 2, 6, 7, 8, 4, 5]
    assert reroute["minutes"] == 25
    incident = client.get("/api/incidents").json()[0]
    client.post(f"/api/incidents/{incident['id']}/resolve", headers=admin)
    assert (
        client.get("/api/routes?origin=1&destination=5").json()["path"] == route["path"]
    )


def test_booking_revalidates_and_enforces_ownership(client, admin, passenger):
    booking = client.post(
        "/api/bookings",
        headers=passenger,
        json={"origin": 1, "destination": 5, "passengers": 2},
    )
    assert booking.status_code == 201 and booking.json()["total"] == 60
    own = client.get("/api/bookings", headers=passenger).json()[0]
    assert (
        client.post(f"/api/bookings/{own['id']}/cancel", headers=admin).status_code
        == 403
    )
    client.post(
        "/api/incidents",
        headers=admin,
        json={"station_id": 3, "title": "Signal fault", "severity": 4},
    )
    updated = client.get("/api/bookings", headers=passenger).json()[0]
    assert updated["rerouted"] and updated["fare"] == 60
    client.post(
        "/api/incidents",
        headers=admin,
        json={"station_id": 1, "title": "Station closure", "severity": 5},
    )
    assert (
        client.post(
            "/api/bookings", headers=passenger, json={"origin": 1, "destination": 5}
        ).status_code
        == 409
    )
    assert (
        client.get("/api/bookings", headers=passenger).json()[0]["current_route"]
        is None
    )
    assert (
        client.post(f"/api/bookings/{own['id']}/cancel", headers=passenger).status_code
        == 200
    )
    assert client.get("/api/dashboard", headers=admin).json()["revenue"] == 0


def test_auth_registration_logout_and_roles(client, passenger):
    assert client.get("/api/dashboard").status_code == 401
    assert client.get("/api/dashboard", headers=passenger).status_code == 403
    assert (
        client.post(
            "/api/auth/login", json={"email": "admin@metro.local", "password": "bad"}
        ).status_code
        == 401
    )
    payload = {
        "name": "New Rider",
        "email": "new@example.com",
        "password": "NewRider123!",
    }
    assert client.post("/api/auth/register", json=payload).status_code == 201
    assert client.post("/api/auth/register", json=payload).status_code == 409
    token = client.post("/api/auth/login", json=payload).json()["token"]
    headers = {"Authorization": "Bearer " + token}
    assert client.get("/api/auth/me", headers=headers).json()["role"] == "passenger"
    assert client.post("/api/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_fifo_capacity_and_alighting(client, admin):
    original = client.get("/api/queues?station_id=1", headers=admin).json()
    client.put(
        "/api/trains/1",
        headers=admin,
        json={"name": "Blue 101", "station_id": 1, "capacity": 3, "status": "running"},
    )
    boarded = client.post("/api/trains/1/board", headers=admin).json()
    assert boarded["passenger_ids"] == [r["id"] for r in original[:3]]
    assert client.post("/api/trains/1/board", headers=admin).json()["boarded"] == 0
    assert len(client.get("/api/queues?station_id=1", headers=admin).json()) == 5
    assert (
        client.put(
            "/api/trains/1",
            headers=admin,
            json={"name": "Blue 101", "station_id": 1, "capacity": 2},
        ).status_code
        == 409
    )
    client.post("/api/trains/1/alight", headers=admin)
    assert client.post("/api/trains/1/board", headers=admin).json()["boarded"] == 3


def test_concurrent_boarding_does_not_double_book(client, admin):
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(
                lambda _: client.post("/api/trains/1/board", headers=admin).json(),
                range(2),
            )
        )
    assert sum(result["boarded"] for result in results) == 8
    ids = [item for result in results for item in result["passenger_ids"]]
    assert len(ids) == len(set(ids))


def test_station_and_train_controls(client, admin, passenger):
    body = {"name": "Harbor", "x": 650, "y": 310}
    assert client.post("/api/stations", headers=passenger, json=body).status_code == 403
    station = client.post("/api/stations", headers=admin, json=body).json()["id"]
    assert client.post("/api/stations", headers=admin, json=body).status_code == 409
    assert (
        client.post(
            "/api/connections",
            headers=admin,
            json={"source": 5, "target": station, "minutes": 6, "line": "Blue"},
        ).status_code
        == 201
    )
    assert client.get(f"/api/routes?origin=1&destination={station}").status_code == 200
    assert (
        client.put(
            f"/api/stations/{station}", headers=admin, json={**body, "active": False}
        ).status_code
        == 200
    )
    assert client.get(f"/api/routes?origin=1&destination={station}").status_code == 409
    assert (
        client.post(
            "/api/trains",
            headers=admin,
            json={"name": "Test train", "station_id": 999, "capacity": 10},
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/api/trains",
            headers=admin,
            json={"name": "Test train", "station_id": 2, "capacity": 10},
        ).status_code
        == 201
    )
    assert client.delete("/api/connections/1", headers=admin).status_code == 200
    assert client.get("/api/routes?origin=1&destination=5").status_code == 409


def test_incident_priority_and_multiple_closures(client, admin):
    for severity in (2, 5, 5):
        client.post(
            "/api/incidents",
            headers=admin,
            json={"station_id": 3, "title": "Test disruption", "severity": severity},
        )
    rows = client.get("/api/incidents").json()
    assert [row["severity"] for row in rows] == [5, 5, 2]
    assert rows[0]["id"] < rows[1]["id"]
    client.post(f"/api/incidents/{rows[0]['id']}/resolve", headers=admin)
    assert 3 in client.get("/api/network").json()["blocked"]
    assert (
        client.post(
            "/api/queues/arrive", headers=admin, json={"station_id": 3, "count": 5}
        ).status_code
        == 409
    )
    assert client.post("/api/trains/3/board", headers=admin).status_code == 409


def test_invalid_inputs_and_missing_records(client, admin):
    assert client.get("/api/routes?origin=1&destination=1").status_code == 409
    assert client.get("/api/routes?origin=999&destination=1").status_code == 409
    assert (
        client.post(
            "/api/queues/arrive", headers=admin, json={"station_id": 1, "count": 0}
        ).status_code
        == 422
    )
    assert client.post("/api/trains/999/board", headers=admin).status_code == 404
    assert client.post("/api/incidents/999/resolve", headers=admin).status_code == 404

