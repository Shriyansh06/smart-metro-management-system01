# 🚇 Smart Metro

A full-stack metro management system that demonstrates real-world applications of **Data Structures & Algorithms (DSA)** — built with **FastAPI** (Python) on the backend and **React + Vite** on the frontend, backed by **SQLite**.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [DSA Topics Used](#dsa-topics-used)
- [Project Structure](#project-structure)
- [Default Credentials](#default-credentials)
- [Prerequisites](#prerequisites)
- [How to Run](#how-to-run)
- [API Reference](#api-reference)
- [Running Tests](#running-tests)
- [Demo Walkthrough](#demo-walkthrough)
- [Honest Scope Note](#honest-scope-note)

---

## Project Overview

Smart Metro is a simulation of a real metro rail network. It supports:

- **Passenger Portal** — search routes, book tickets, view/cancel bookings, get live rerouting alerts
- **Admin Panel** — manage stations, connections, trains, passenger queues, and incidents
- **Crowd Analytics** — daily passenger arrival charts, peak hour, busiest stations, and connected service areas

Every feature is backed by a concrete DSA technique applied operationally — not as a demo screen.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.10+, FastAPI 0.115, Uvicorn |
| Database | SQLite 3 (via Python stdlib) |
| Frontend | React 19, Vite 6, Tailwind CSS 4, Lucide Icons |
| Testing | Pytest + HTTPX (backend), Vitest (frontend unit), Playwright (E2E) |

---

## DSA Topics Used

This section maps every DSA concept to the exact feature it powers and the source file that implements it.

---

### Unit I — Linear Data Structures

#### 1. 🗂️ Queue (FIFO) — Passenger Boarding

| | |
|---|---|
| **Feature** | Passengers queue at a station and board trains in strict arrival order |
| **Implementation** | Passengers are inserted with an auto-increment `id`. Boarding fetches them with `ORDER BY id LIMIT <seats>`, guaranteeing FIFO without an explicit queue object |
| **Files** | `backend/app/main.py` — `arrive()`, `board()`, `queues()` |
| **Complexity** | Enqueue O(1) · Dequeue O(K) for K boarded passengers |

```python
# main.py — board() — passengers dequeued in FIFO arrival order
passengers = db.execute(
    "SELECT id FROM passengers WHERE station_id=? AND status='waiting' ORDER BY id LIMIT ?",
    (train["station_id"], seats),
).fetchall()
```

---

#### 2. 🔺 Priority Queue / Binary Heap — Incident Management

| | |
|---|---|
| **Feature** | Active incidents are displayed highest-severity first; equal severity preserves report order |
| **Implementation** | Python's `heapq` module (a min-heap) with negated severity turns it into a max-heap. `heapq.heapify()` builds the heap in O(N), `heapq.heappop()` extracts in O(log N) |
| **File** | `backend/app/main.py` — `incidents()` |
| **Complexity** | Build O(N) · Extract all O(N log N) |

```python
# main.py — incidents()
heap = [(-r["severity"], r["id"], r) for r in rows if r["status"] == "active"]
heapq.heapify(heap)
ordered = [heapq.heappop(heap)[2] for _ in range(len(heap))]
```

---

### Unit II — Searching & Indexing

#### 3. 🌲 B-Tree Index (SQLite) — Fast Passenger & Booking Queries

| | |
|---|---|
| **Feature** | Querying a passenger's queue position, booking history, and arrival-time range for crowd analytics |
| **Implementation** | Three explicit SQLite indexes are created at startup. SQLite internally uses a B-tree for each index, giving O(log N) lookup vs. O(N) full-table scan |
| **File** | `backend/app/database.py` — `initialize()` |

```sql
-- database.py — indexes created at startup
CREATE INDEX IF NOT EXISTS queue_order             ON passengers(station_id, status, id);
CREATE INDEX IF NOT EXISTS booking_owner           ON bookings(user_id);
CREATE INDEX IF NOT EXISTS passenger_arrival_time  ON passengers(created);
```

---

### Unit III — Graph Algorithms

#### 4. 🗺️ Weighted Graph (Adjacency List) + Dijkstra's Algorithm — Route Planning

| | |
|---|---|
| **Feature** | Find the shortest route (by travel minutes) between any two stations. Automatically reroutes around closed stations and active incidents |
| **Implementation** | Stations are vertices; track connections are weighted edges stored as an adjacency list dictionary. Dijkstra's algorithm with a min-heap frontier finds the optimal path. Blocked stations are excluded before the search begins |
| **File** | `backend/app/routing.py` — `shortest_route()` |
| **Complexity** | O((V + E) log V) where V = open stations, E = connections |

```python
# routing.py — Dijkstra core
frontier = [(0, origin, [], [])]   # (cost, node, path, lines)
best = {origin: 0}
while frontier:
    cost, node, path, lines = heapq.heappop(frontier)
    ...
    for neighbor, weight, line in adjacency[node]:
        if cost + weight < best.get(neighbor, float("inf")):
            best[neighbor] = cost + weight
            heapq.heappush(frontier, (cost + weight, neighbor, path, lines + [line]))
```

**Where this appears in the UI:**
- `GET /api/routes` — live route lookup on the Passenger Portal
- `POST /api/bookings` — route computed at booking time, fare stored
- `GET /api/bookings` — each booking re-checks current route; if the path changed, a rerouting alert is shown

---

### Unit IV — Sorting & Hashing

#### 5. 🔀 Merge Sort — Busiest-Station Ranking

| | |
|---|---|
| **Feature** | Crowd analytics screen ranks stations by number of arrivals, busiest first |
| **Implementation** | A custom stable merge sort (`merge_rank`) sorts station records by `arrivals` descending. Stable sort preserves the original station order for ties |
| **File** | `backend/app/analytics.py` — `merge_rank()` |
| **Complexity** | O(S log S) time · O(S) extra space for S stations |

```python
# analytics.py — merge_rank()
def merge_rank(rows):
    """Stable merge sort: busiest first, retaining station order for ties."""
    if len(rows) <= 1:
        return rows[:]
    middle = len(rows) // 2
    left, right = merge_rank(rows[:middle]), merge_rank(rows[middle:])
    output = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i]['arrivals'] >= right[j]['arrivals']:   # >= keeps stable order
            output.append(left[i]); i += 1
        else:
            output.append(right[j]); j += 1
    return output + left[i:] + right[j:]
```

---

#### 6. 🗄️ Hash Map / Dictionary — Per-Station & Hourly Aggregation

| | |
|---|---|
| **Feature** | Crowd report shows total arrivals, per-station counts, and a 24-bar hourly chart |
| **Implementation** | A dictionary `counts` maps `station_id → {arrivals: N}` for O(1) per-arrival updates. A 24-slot list `hourly` counts arrivals by hour of day |
| **File** | `backend/app/analytics.py` — `crowd_report()` |
| **Complexity** | O(P) expected for P passenger records |

```python
# analytics.py — crowd_report()
hourly = [0] * 24                             # 24-slot array — one bucket per hour
counts = {s['id']: dict(id=s['id'], name=s['name'], arrivals=0) for s in stations}  # hash map
for row in db.execute(...):
    hourly[hour] += 1
    counts[row['station_id']]['arrivals'] += 1  # O(1) dictionary update
```

---

### Unit V — Advanced Data Structures

#### 7. 🔤 Trie — Station Name Autocomplete

| | |
|---|---|
| **Feature** | Typing in any station search box shows prefix-matched suggestions instantly |
| **Implementation** | All station names are inserted into a Trie on each request. `autocomplete(prefix)` traverses to the prefix node, then collects all words below with a DFS. Case-insensitive; handles renamed/new stations automatically |
| **Files** | `backend/app/structures.py` — `Trie` class · `backend/app/analytics.py` — `station_suggestions()` · `frontend/src/components.jsx` — `StationSelect` component |
| **Complexity** | Insert O(L) · Prefix search O(L + K) where L = prefix length, K = results |

```python
# structures.py — Trie.autocomplete()
def autocomplete(self, prefix):
    node = self.root
    for letter in prefix:        # walk to prefix node
        if letter not in node:
            return []
        node = node[letter]
    words = []
    def collect(branch, text):   # DFS to gather all words below prefix
        if "$" in branch:
            words.append(text)
        for letter in sorted(k for k in branch if k != "$"):
            collect(branch[letter], text + letter)
    collect(node, prefix)
    return words
```

---

#### 8. 🔗 Union-Find / Disjoint Set — Connected Service Areas

| | |
|---|---|
| **Feature** | Crowd analytics shows which groups of stations are still mutually reachable after incidents close some stations |
| **Implementation** | `DisjointSet` with **union by rank** and **path compression**. Available stations are `make-set`; each open track connection calls `union`. `find` with path compression groups them into connected components |
| **Files** | `backend/app/structures.py` — `DisjointSet` class · `backend/app/analytics.py` — `crowd_report()` |
| **Complexity** | Near O(1) amortised per operation (inverse-Ackermann) |

```python
# structures.py — DisjointSet
def find(self, value):
    if self.parent[value] != value:
        self.parent[value] = self.find(self.parent[value])  # path compression
    return self.parent[value]

def union(self, a, b):
    a, b = self.find(a), self.find(b)
    if a == b: return False
    if self.rank[a] < self.rank[b]: a, b = b, a
    self.parent[b] = a                                      # union by rank
    if self.rank[a] == self.rank[b]: self.rank[a] += 1
    return True
```

---

### ✅ DSA Summary Table

| # | DSA Topic | Unit | Feature in App | Source File |
|---|---|---|---|---|
| 1 | Queue (FIFO) | I | Passenger boarding in arrival order | `main.py` — `arrive`, `board` |
| 2 | Binary Heap (Priority Queue) | I | Incidents sorted by severity | `main.py` — `incidents` |
| 3 | B-Tree Index (SQLite) | II | Fast passenger / booking / arrival queries | `database.py` — `initialize` |
| 4 | Weighted Graph + Dijkstra | III | Shortest route & live rerouting | `routing.py` — `shortest_route` |
| 5 | Merge Sort (custom stable) | IV | Station ranking by crowd size | `analytics.py` — `merge_rank` |
| 6 | Hash Map / Dictionary | IV | Per-station & hourly arrival aggregation | `analytics.py` — `crowd_report` |
| 7 | Trie | V | Station name autocomplete | `structures.py` · `analytics.py` |
| 8 | Union-Find (Disjoint Set) | V | Connected service area detection | `structures.py` · `analytics.py` |

---

## Project Structure

```
smart-metro/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI routes, auth, bookings, queues, incidents
│   │   ├── routing.py       # Graph + Dijkstra (Unit III)
│   │   ├── analytics.py     # Merge sort, hashing, Trie, Union-Find (Units IV, V)
│   │   ├── structures.py    # Trie & DisjointSet classes (Unit V)
│   │   └── database.py      # SQLite schema, indexes, seed data (Unit II)
│   ├── tests/               # Pytest backend tests
│   ├── requirements.txt     # Python dependencies
│   └── metro.sqlite3        # SQLite database (auto-created on first run)
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Router and layout
│   │   ├── Portal.jsx       # Passenger portal (route search, bookings)
│   │   ├── Admin.jsx        # Admin panel (stations, trains, incidents)
│   │   ├── Crowd.jsx        # Crowd analytics dashboard
│   │   ├── components.jsx   # Shared components incl. StationSelect (Trie UI)
│   │   └── styles.css       # Global styles
│   ├── dist/                # Prebuilt production frontend (run without Node.js)
│   ├── e2e/                 # Playwright end-to-end tests
│   └── package.json
├── docs/
│   ├── SYLLABUS.md          # Detailed DSA-to-feature mapping
│   ├── ARCHITECTURE.md      # Architecture decisions
│   └── VERIFICATION.md
├── setup.py                 # One-command setup script
├── run.py                   # One-command server launcher
└── start-windows.bat        # Windows double-click launcher
```

---

## Default Credentials

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@metro.local` | `Admin123!` |
| **Passenger** | `passenger@metro.local` | `Passenger123!` |

> The database is seeded automatically on first run. You can register new passenger accounts from the sign-up screen. New registrations always receive the passenger role.

---

## Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Python | 3.10 or newer | `python --version` |
| Node.js | 22.12 LTS or 24+ *(only for dev/rebuild)* | `node --version` |
| npm | Bundled with Node.js | `npm --version` |

> **Node.js is NOT required to simply run the app.** The `frontend/dist/` folder contains a prebuilt frontend. Node.js is only needed if you want to rebuild the frontend or run frontend tests.

---

## How to Run

### ▶️ Option A — Windows Quick Start (Recommended)

Double-click **`start-windows.bat`** in the project root.
It will install dependencies and start the server automatically.

Open **http://127.0.0.1:8000** in your browser.

---

### ▶️ Option B — Manual Setup (All Platforms)

#### Step 1 — Open a terminal in the project folder

```bash
cd smart-metro
```

#### Step 2 — Install dependencies and build the frontend

```bash
python setup.py
```

On Windows, if `python` is not found:

```bash
py -3 setup.py
```

This single command:
- Creates a project-local Python virtual environment at `backend/.venv`
- Installs all Python packages from `backend/requirements.txt`
- Runs `npm ci` + `npm run build` inside the `frontend/` folder *(only if dist is missing)*

> To force a frontend rebuild (e.g., after editing React code):
> ```bash
> python setup.py --rebuild
> ```

#### Step 3 — Start the server

```bash
python run.py
```

Then open **http://127.0.0.1:8000**.

Interactive API docs (Swagger UI): **http://127.0.0.1:8000/docs**

To use a custom port:

```bash
python run.py --port 9000
```

Stop the server with `Ctrl+C`.

---

### ▶️ Option C — Development Mode (Hot Reload)

Run the backend and frontend in **two separate terminals** for live reloading.

**Terminal 1 — Backend** *(run from the `backend/` directory)*

```bash
# Windows
.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# macOS / Linux
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Frontend** *(run from the `frontend/` directory)*

```bash
npm ci          # install packages (first time only)
npm run dev     # start Vite dev server
```

Frontend dev server opens at **http://127.0.0.1:5173**.
Vite automatically proxies `/api` calls to port 8000 — no CORS configuration needed.

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | Health check |
| POST | `/api/auth/register` | — | Create passenger account |
| POST | `/api/auth/login` | — | Sign in, receive bearer token |
| GET | `/api/auth/me` | Passenger | Current user info |
| POST | `/api/auth/logout` | Passenger | Invalidate session |
| GET | `/api/network` | — | All stations, edges, blocked set |
| GET | `/api/routes?origin=&destination=` | — | **Dijkstra** shortest route |
| POST | `/api/bookings` | Passenger | Book a ticket |
| GET | `/api/bookings` | Passenger | My bookings with rerouting status |
| POST | `/api/bookings/{id}/cancel` | Passenger | Cancel a booking |
| GET | `/api/dashboard` | Admin | Live stats summary |
| POST | `/api/stations` | Admin | Add a station |
| PUT | `/api/stations/{id}` | Admin | Update a station |
| POST | `/api/connections` | Admin | Add a track connection |
| DELETE | `/api/connections/{id}` | Admin | Remove a connection |
| GET | `/api/trains` | — | List all trains |
| POST | `/api/trains` | Admin | Add a train |
| PUT | `/api/trains/{id}` | Admin | Update a train |
| GET | `/api/queues?station_id=` | Admin | View station **FIFO queue** |
| POST | `/api/queues/arrive` | Admin | Simulate passenger arrivals |
| POST | `/api/trains/{id}/board` | Admin | Board waiting passengers (FIFO) |
| POST | `/api/trains/{id}/alight` | Admin | Alight all passengers |
| GET | `/api/incidents` | — | Incidents sorted by **priority heap** |
| POST | `/api/incidents` | Admin | Report a disruption |
| POST | `/api/incidents/{id}/resolve` | Admin | Resolve an incident |
| GET | `/api/analytics/crowd?day=YYYY-MM-DD` | Admin | Daily crowd report (**merge sort + hash map**) |
| GET | `/api/stations/suggest?prefix=` | — | **Trie** autocomplete |

---

## Running Tests

### Backend (Pytest)

```bash
# Windows — run from the backend/ directory
.venv\Scripts\python -m pytest -q

# macOS / Linux
.venv/bin/python -m pytest -q
```

### Frontend Unit Tests (Vitest)

```bash
cd frontend
npm ci
npm test
```

### End-to-End Tests (Playwright)

Requires a running server and a fresh seeded database:

```bash
cd frontend
npx playwright install chromium   # first time only
npm run build
npm run test:e2e
```

### Full Verification (all suites)

```bash
# From the project root — starts/stops an isolated server automatically
python verify.py
```

---

## Demo Walkthrough

1. **As a guest**, plan **Central → Airport** — the normal route takes 19 minutes.
2. Sign in as the **passenger**, book the journey, and open **My Bookings**.
3. Sign out; sign in as **admin**. Go to **Disruptions** and report a Priority-5 signal fault at **University**.
4. Plan the same journey again — it now reroutes via **Old Town → Riverside → Stadium** (25 minutes).
5. In **Passenger Queues**, select Central. Eight seeded passengers are waiting; add five more, then board **Blue 101**. Thirteen passengers board in arrival order (FIFO). Alight them to free capacity.
6. Resolve the incident. The original 19-minute route is restored.
7. Open **Overview** to see hourly arrivals, peak hour, busiest stations (merge-sorted), and connected service areas (union-find). Type a prefix in any station search box to see the trie autocomplete.

---

## Data & Persistence

- On first startup, `backend/metro.sqlite3` is created and seeded: **9 stations, 10 track links, 3 trains, 8 waiting passengers, and 2 accounts**.
- No external database service or API key is needed.
- To **reset to a clean state**, stop the server and delete (or rename) `backend/metro.sqlite3`. The next start seeds everything fresh.
- The environment variable `METRO_DB` overrides the database file path.
- Sessions expire after 24 hours; logout removes them immediately.

---

## Honest Scope Note

This project covers concepts from all five DSA units but does **not** claim to implement every syllabus topic:

- **SQLite** supplies the B-tree index — it is not a hand-written tree.
- The Trie is rebuilt on every autocomplete request (fine for a small network; a larger deployment would cache it).
- Union-Find is also rebuilt from live edges because standard union-find does not support edge deletion.
- Custom AVL/B+ trees, polynomial lists, sparse matrices, all six classical sorting algorithms, and every hashing variant are **not** implemented here.

See [`docs/SYLLABUS.md`](docs/SYLLABUS.md) for the full, honest unit-by-unit mapping and the recommended viva explanation.
