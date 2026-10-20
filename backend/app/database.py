import hashlib
import os
import secrets
import sqlite3
from contextlib import contextmanager
from pathlib import Path


def password_hash(password, salt):
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), 200_000
    ).hex()


@contextmanager
def connect():
    path = Path(
        os.getenv("METRO_DB", Path(__file__).resolve().parents[1] / "metro.sqlite3")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    try:
        with db:
            yield db
    finally:
        db.close()


def initialize():
    with connect() as db:
        db.executescript(
            """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
            salt TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS stations (
            id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, x INTEGER, y INTEGER,
            active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS edges (
            id INTEGER PRIMARY KEY, source INTEGER REFERENCES stations(id),
            target INTEGER REFERENCES stations(id), minutes INTEGER NOT NULL, line TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS trains (
            id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, station_id INTEGER REFERENCES stations(id),
            capacity INTEGER NOT NULL, onboard INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY, reference TEXT UNIQUE NOT NULL, user_id INTEGER REFERENCES users(id),
            origin INTEGER REFERENCES stations(id), destination INTEGER REFERENCES stations(id),
            passengers INTEGER NOT NULL, fare INTEGER NOT NULL, path TEXT NOT NULL,
            status TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS passengers (
            id INTEGER PRIMARY KEY, station_id INTEGER REFERENCES stations(id),
            name TEXT NOT NULL, status TEXT DEFAULT 'waiting', train_id INTEGER REFERENCES trains(id),
            created TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY, station_id INTEGER REFERENCES stations(id), title TEXT NOT NULL,
            severity INTEGER NOT NULL, status TEXT DEFAULT 'active', created TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX IF NOT EXISTS queue_order ON passengers(station_id, status, id);
        CREATE INDEX IF NOT EXISTS booking_owner ON bookings(user_id);
        CREATE INDEX IF NOT EXISTS passenger_arrival_time ON passengers(created);
        """
        )
        if db.execute("SELECT COUNT(*) FROM stations").fetchone()[0] == 0:
            stations = [
                (1, "Central", 100, 180),
                (2, "Museum", 240, 180),
                (3, "University", 380, 180),
                (4, "Tech Park", 520, 180),
                (5, "Airport", 660, 180),
                (6, "Old Town", 240, 310),
                (7, "Riverside", 380, 310),
                (8, "Stadium", 520, 310),
                (9, "North Gate", 380, 65),
            ]
            db.executemany(
                "INSERT INTO stations(id,name,x,y) VALUES (?,?,?,?)", stations
            )
            edges = [
                (1, 2, 4, "Blue"),
                (2, 3, 3, "Blue"),
                (3, 4, 5, "Blue"),
                (4, 5, 7, "Blue"),
                (2, 6, 4, "Green"),
                (6, 7, 3, "Green"),
                (7, 8, 4, "Green"),
                (8, 4, 3, "Green"),
                (3, 9, 3, "Amber"),
                (3, 7, 4, "Amber"),
            ]
            db.executemany(
                "INSERT INTO edges(source,target,minutes,line) VALUES (?,?,?,?)", edges
            )
            db.executemany(
                "INSERT INTO trains(name,station_id,capacity,status) VALUES (?,?,?,?)",
                [
                    ("Blue 101", 1, 80, "running"),
                    ("Green 202", 6, 60, "running"),
                    ("Amber 303", 3, 50, "running"),
                ],
            )
            db.executemany(
                "INSERT INTO passengers(station_id,name) VALUES (?,?)",
                [(1, f"Passenger {i:02}") for i in range(1, 9)],
            )
        for name, email, password, role in [
            ("Metro Admin", "admin@metro.local", "Admin123!", "admin"),
            ("Aarav", "passenger@metro.local", "Passenger123!", "passenger"),
        ]:
            if not db.execute(
                "SELECT id FROM users WHERE email=?", (email,)
            ).fetchone():
                salt = secrets.token_hex(16)
                db.execute(
                    "INSERT INTO users(name,email,salt,password,role) VALUES (?,?,?,?,?)",
                    (name, email, salt, password_hash(password, salt), role),
                )
