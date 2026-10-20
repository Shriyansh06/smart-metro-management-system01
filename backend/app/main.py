import heapq
import hmac
import json
import secrets
import sqlite3
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .database import connect, initialize, password_hash
from .routing import network, shortest_route
from datetime import date, datetime
from .analytics import IST, crowd_report, station_suggestions


@asynccontextmanager
async def lifespan(app):
    initialize()
    yield


app = FastAPI(title="Smart Metro API", version="1.0.0", lifespan=lifespan)


def current_user(authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ")
    with connect() as db:
        user = db.execute(
            "SELECT u.id,u.name,u.email,u.role FROM users u JOIN sessions s "
            "ON s.user_id=u.id WHERE s.token=? AND s.expires>?",
            (token, time.time()),
        ).fetchone()
    if not user:
        raise HTTPException(401, "Please sign in again.")
    return dict(user)


def administrator(user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Administrator access required.")
    return user


def required(db, table, record_id):
    # The table is always an internal constant, never request input.
    row = db.execute(f"SELECT * FROM {table} WHERE id=?", (record_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Record not found.")
    return row


def route_or_error(db, origin, destination):
    try:
        return shortest_route(db, origin, destination)
    except ValueError as error:
        raise HTTPException(409, str(error)) from error


class Login(BaseModel):
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=1, max_length=128)


class Registration(Login):
    name: str = Field(min_length=2, max_length=60)
    password: str = Field(min_length=8, max_length=128)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/register", status_code=201)
def register(body: Registration):
    email = body.email.strip().lower()
    if "@" not in email or not body.name.strip():
        raise HTTPException(422, "Enter a valid name and email.")
    salt = secrets.token_hex(16)
    try:
        with connect() as db:
            db.execute(
                "INSERT INTO users(name,email,salt,password,role) VALUES (?,?,?,?,?)",
                (
                    body.name.strip(),
                    email,
                    salt,
                    password_hash(body.password, salt),
                    "passenger",
                ),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(409, "An account with this email already exists.")
    return {"message": "Account created. You can sign in now."}


@app.post("/api/auth/login")
def login(body: Login):
    with connect() as db:
        row = db.execute(
            "SELECT * FROM users WHERE email=?", (body.email.strip().lower(),)
        ).fetchone()
        if not row or not hmac.compare_digest(
            row["password"], password_hash(body.password, row["salt"])
        ):
            raise HTTPException(401, "Email or password is incorrect.")
        token = secrets.token_urlsafe(32)
        db.execute("DELETE FROM sessions WHERE expires<?", (time.time(),))
        db.execute(
            "INSERT INTO sessions VALUES (?,?,?)",
            (token, row["id"], time.time() + 86400),
        )
        return {
            "token": token,
            "user": {key: row[key] for key in ("id", "name", "email", "role")},
        }


@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    return user


@app.post("/api/auth/logout")
def logout(authorization: str = Header(default="")):
    with connect() as db:
        db.execute(
            "DELETE FROM sessions WHERE token=?",
            (authorization.removeprefix("Bearer "),),
        )
    return {"message": "Signed out."}


@app.get("/api/network")
def get_network():
    with connect() as db:
        stations, edges, blocked = network(db)
        return {"stations": stations, "edges": edges, "blocked": sorted(blocked)}


@app.get("/api/routes")
def routes(origin: int, destination: int):
    with connect() as db:
        return route_or_error(db, origin, destination)


class Booking(BaseModel):
    origin: int
    destination: int
    passengers: int = Field(default=1, ge=1, le=8)


@app.post("/api/bookings", status_code=201)
def book(body: Booking, user=Depends(current_user)):
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        route = route_or_error(db, body.origin, body.destination)
        reference = "SM-" + secrets.token_hex(4).upper()
        db.execute(
            "INSERT INTO bookings(reference,user_id,origin,destination,passengers,fare,path,status) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (
                reference,
                user["id"],
                body.origin,
                body.destination,
                body.passengers,
                route["fare"] * body.passengers,
                json.dumps(route["path"]),
                "confirmed",
            ),
        )
    return {
        "reference": reference,
        "route": route,
        "total": route["fare"] * body.passengers,
    }


@app.get("/api/bookings")
def bookings(user=Depends(current_user)):
    with connect() as db:
        rows = [
            dict(r)
            for r in db.execute(
                "SELECT * FROM bookings WHERE user_id=? ORDER BY id DESC", (user["id"],)
            )
        ]
        for row in rows:
            row["path"] = json.loads(row["path"])
            try:
                row["current_route"] = shortest_route(
                    db, row["origin"], row["destination"]
                )
                row["rerouted"] = row["current_route"]["path"] != row["path"]
            except ValueError as error:
                row["current_route"] = None
                row["route_notice"] = str(error)
        return rows


@app.post("/api/bookings/{booking_id}/cancel")
def cancel(booking_id: int, user=Depends(current_user)):
    with connect() as db:
        row = required(db, "bookings", booking_id)
        if row["user_id"] != user["id"]:
            raise HTTPException(403, "This booking belongs to another passenger.")
        db.execute("UPDATE bookings SET status='cancelled' WHERE id=?", (booking_id,))
    return {"message": "Booking cancelled."}


@app.get("/api/dashboard")
def dashboard(user=Depends(administrator)):
    with connect() as db:
        return {
            "stations": db.execute(
                "SELECT COUNT(*) FROM stations WHERE active=1"
            ).fetchone()[0],
            "trains": db.execute(
                "SELECT COUNT(*) FROM trains WHERE status='running'"
            ).fetchone()[0],
            "waiting": db.execute(
                "SELECT COUNT(*) FROM passengers WHERE status='waiting'"
            ).fetchone()[0],
            "bookings": db.execute(
                "SELECT COUNT(*) FROM bookings WHERE status='confirmed'"
            ).fetchone()[0],
            "revenue": db.execute(
                "SELECT COALESCE(SUM(fare),0) FROM bookings WHERE status='confirmed'"
            ).fetchone()[0],
            "incidents": db.execute(
                "SELECT COUNT(*) FROM incidents WHERE status='active'"
            ).fetchone()[0],
            "queues": [
                dict(r)
                for r in db.execute(
                    "SELECT s.name,COUNT(p.id) AS waiting FROM stations s LEFT JOIN "
                    "passengers p ON p.station_id=s.id AND p.status='waiting' GROUP BY s.id ORDER BY waiting DESC"
                )
            ],
        }


class Station(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    x: int = Field(ge=40, le=720)
    y: int = Field(ge=40, le=350)
    active: bool = True


@app.post("/api/stations", status_code=201)
def add_station(body: Station, user=Depends(administrator)):
    try:
        with connect() as db:
            cursor = db.execute(
                "INSERT INTO stations(name,x,y,active) VALUES (?,?,?,?)",
                (body.name.strip(), body.x, body.y, body.active),
            )
            return {"id": cursor.lastrowid}
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Station name already exists.")


@app.put("/api/stations/{station_id}")
def update_station(station_id: int, body: Station, user=Depends(administrator)):
    try:
        with connect() as db:
            required(db, "stations", station_id)
            db.execute(
                "UPDATE stations SET name=?,x=?,y=?,active=? WHERE id=?",
                (body.name.strip(), body.x, body.y, body.active, station_id),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Station name already exists.")
    return {"message": "Station updated."}


class Connection(BaseModel):
    source: int
    target: int
    minutes: int = Field(ge=1, le=120)
    line: str = Field(min_length=1, max_length=30)


@app.post("/api/connections", status_code=201)
def add_connection(body: Connection, user=Depends(administrator)):
    with connect() as db:
        required(db, "stations", body.source)
        required(db, "stations", body.target)
        if body.source == body.target:
            raise HTTPException(422, "A connection needs two different stations.")
        if db.execute(
            "SELECT id FROM edges WHERE (source=? AND target=?) OR (source=? AND target=?)",
            (body.source, body.target, body.target, body.source),
        ).fetchone():
            raise HTTPException(409, "These stations are already connected.")
        db.execute(
            "INSERT INTO edges(source,target,minutes,line) VALUES (?,?,?,?)",
            (body.source, body.target, body.minutes, body.line),
        )
    return {"message": "Connection added."}


@app.delete("/api/connections/{edge_id}")
def remove_connection(edge_id: int, user=Depends(administrator)):
    with connect() as db:
        required(db, "edges", edge_id)
        db.execute("DELETE FROM edges WHERE id=?", (edge_id,))
    return {"message": "Connection removed."}


class Train(BaseModel):
    name: str = Field(min_length=2, max_length=40)
    station_id: int
    capacity: int = Field(ge=1, le=1000)
    status: Literal["running", "maintenance"] = "running"


@app.get("/api/trains")
def trains():
    with connect() as db:
        return [dict(r) for r in db.execute("SELECT * FROM trains ORDER BY id")]


def save_train(body, train_id=None):
    try:
        with connect() as db:
            required(db, "stations", body.station_id)
            if train_id is not None:
                row = required(db, "trains", train_id)
                if body.capacity < row["onboard"]:
                    raise HTTPException(
                        409, "Capacity cannot be smaller than the onboard count."
                    )
                db.execute(
                    "UPDATE trains SET name=?,station_id=?,capacity=?,status=? WHERE id=?",
                    (body.name, body.station_id, body.capacity, body.status, train_id),
                )
            else:
                db.execute(
                    "INSERT INTO trains(name,station_id,capacity,status) VALUES (?,?,?,?)",
                    (body.name, body.station_id, body.capacity, body.status),
                )
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Train name already exists.")
    return {"message": "Train saved."}


@app.post("/api/trains", status_code=201)
def add_train(body: Train, user=Depends(administrator)):
    return save_train(body)


@app.put("/api/trains/{train_id}")
def update_train(train_id: int, body: Train, user=Depends(administrator)):
    return save_train(body, train_id)


class Arrival(BaseModel):
    station_id: int
    count: int = Field(ge=1, le=100)


@app.get("/api/queues")
def queues(station_id: int, user=Depends(administrator)):
    with connect() as db:
        required(db, "stations", station_id)
        return [
            dict(r)
            for r in db.execute(
                "SELECT * FROM passengers WHERE station_id=? AND status='waiting' ORDER BY id",
                (station_id,),
            )
        ]


@app.post("/api/queues/arrive")
def arrive(body: Arrival, user=Depends(administrator)):
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        station = required(db, "stations", body.station_id)
        if body.station_id in network(db)[2]:
            raise HTTPException(409, "Arrivals are paused at closed stations.")
        count = db.execute(
            "SELECT COUNT(*) FROM passengers WHERE station_id=? AND status='waiting'",
            (body.station_id,),
        ).fetchone()[0]
        if count + body.count > 500:
            raise HTTPException(
                409,
                "Simulation queue limit is 500 per station. Board passengers first.",
            )
        db.executemany(
            "INSERT INTO passengers(station_id,name) VALUES (?,?)",
            [
                (station["id"], f"Rider {secrets.token_hex(2).upper()}")
                for _ in range(body.count)
            ],
        )
    return {"message": f"{body.count} passengers joined the queue."}


@app.post("/api/trains/{train_id}/board")
def board(train_id: int, user=Depends(administrator)):
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        train = required(db, "trains", train_id)
        if train["status"] != "running" or train["station_id"] in network(db)[2]:
            raise HTTPException(
                409, "Boarding requires a running train at an open station."
            )
        seats = train["capacity"] - train["onboard"]
        passengers = db.execute(
            "SELECT id FROM passengers WHERE station_id=? AND status='waiting' ORDER BY id LIMIT ?",
            (train["station_id"], seats),
        ).fetchall()
        db.executemany(
            "UPDATE passengers SET status='boarded',train_id=? WHERE id=?",
            [(train_id, p["id"]) for p in passengers],
        )
        db.execute(
            "UPDATE trains SET onboard=onboard+? WHERE id=?",
            (len(passengers), train_id),
        )
    return {
        "boarded": len(passengers),
        "passenger_ids": [p["id"] for p in passengers],
        "message": f"{len(passengers)} passengers boarded in arrival order.",
    }


@app.post("/api/trains/{train_id}/alight")
def alight(train_id: int, user=Depends(administrator)):
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        required(db, "trains", train_id)
        db.execute(
            "UPDATE passengers SET status='completed' WHERE train_id=? AND status='boarded'",
            (train_id,),
        )
        db.execute("UPDATE trains SET onboard=0 WHERE id=?", (train_id,))
    return {"message": "All passengers alighted."}


class Incident(BaseModel):
    station_id: int
    title: str = Field(min_length=3, max_length=120)
    severity: int = Field(ge=1, le=5)


@app.get("/api/incidents")
def incidents():
    with connect() as db:
        rows = [dict(r) for r in db.execute("SELECT * FROM incidents")]
    heap = [(-r["severity"], r["id"], r) for r in rows if r["status"] == "active"]
    heapq.heapify(heap)
    ordered = [heapq.heappop(heap)[2] for _ in range(len(heap))]
    return ordered + sorted(
        (r for r in rows if r["status"] != "active"), key=lambda r: -r["id"]
    )


@app.post("/api/incidents", status_code=201)
def report_incident(body: Incident, user=Depends(administrator)):
    with connect() as db:
        required(db, "stations", body.station_id)
        db.execute(
            "INSERT INTO incidents(station_id,title,severity) VALUES (?,?,?)",
            (body.station_id, body.title, body.severity),
        )
    return {"message": "Disruption recorded. Routes now avoid this station."}


@app.post("/api/incidents/{incident_id}/resolve")
def resolve(incident_id: int, user=Depends(administrator)):
    with connect() as db:
        required(db, "incidents", incident_id)
        db.execute("UPDATE incidents SET status='resolved' WHERE id=?", (incident_id,))
    return {"message": "Incident resolved. Routes recalculated."}


@app.get("/api/analytics/crowd")
def daily_crowd(day: date | None = None, user=Depends(administrator)):
    with connect() as db:
        return crowd_report(db, day or datetime.now(IST).date())


@app.get("/api/stations/suggest")
def suggest_stations(prefix: str = Query(default="", max_length=50)):
    with connect() as db:
        return station_suggestions(db, prefix)


# A built frontend can be served by the same process as the API.
dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if dist.exists():
    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/")
    def index():
        return FileResponse(dist / "index.html")
