# Where the syllabus is used in this website

The Algorithm Lab is removed. These are actual operational uses.

| Unit | Website feature | Implementation and source |
| --- | --- | --- |
| I | Passenger boarding | Persistent FIFO queue ordered by arrival ID; transactional boarding in `backend/app/main.py`: `queues`, `arrive`, `board`. |
| I | Emergency handling | Binary heap priority queue: severity first, arrival order for ties; `main.py`: `incidents`. |
| II | Stored passenger and booking queries | SQLite-managed B-tree indexes, including the arrival timestamp index; `backend/app/database.py`. |
| III | Route planning and rerouting | Weighted adjacency-list graph and Dijkstra; closed stations removed before searching; `backend/app/routing.py`. |
| IV | Busiest-station ranking | Custom stable merge sort; `backend/app/analytics.py`: `merge_rank`. |
| IV | Passenger totals and station lookup | Hash maps/dictionaries aggregate per-station counts; a 24-slot array counts hourly arrivals; `analytics.py`: `crowd_report`. |
| V | Station autocomplete | Trie insertion and prefix search; `backend/app/structures.py`: `Trie`; `analytics.py`: `station_suggestions`; `frontend/src/components.jsx`: `StationSelect`. |
| V | Connected service areas | Union-find with make-set, union by rank and path compression; `structures.py`: `DisjointSet`; `analytics.py`: `crowd_report`. |

## Daily crowd definition

`frontend/src/Crowd.jsx` displays `/api/analytics/crowd`. One passenger row is one recorded simulation arrival. Its creation time determines the hourly bucket. Boarding and alighting do not erase an arrival. Bookings are separate travel entitlements and are not added to this total, avoiding double counting.

Reports use India time (UTC+05:30), including exact midnight boundaries. Bars show **hourly arrivals, not historical occupancy**. “Waiting right now” is the current queue across all dates. The date picker supports historical reports; data refreshes every 30 seconds while Overview is open. Empty days remain zero. Seeded riders and simulated arrivals are demo data, not real metro measurements.

Merge sort takes O(S log S) time and O(S) extra space for S stations. Dictionary aggregation takes expected O(P) time for P arrivals. SQLite's timestamp index narrows the date query.

## A chart is not a graph data structure

The hourly chart visualizes numbers. Unit III is used by the metro network: stations are vertices, tracks are edges and travel minutes are weights.

## Honest syllabus scope

This website uses concepts from all five units, but **does not implement every topic**. It does not claim practical use of custom AVL/B+/threaded trees, polynomial lists, sparse matrices, all six sorting algorithms or every hashing method. SQLite supplies the database B-tree implementation; it is not a custom student-written B-tree.

Trie lookup is case-insensitive and rebuilt from current station names per request, so new/renamed stations appear immediately. A larger deployment would cache this with invalidation. Union-find is rebuilt from available links because ordinary union-find does not support deleting edges directly. Closed stations are excluded from connected service areas.

## Viva explanation

“We use FIFO for fair boarding, a priority heap for emergencies, a weighted graph for routes, merge sort and hashing for crowd reports, a trie for station suggestions, union-find for connectivity, and SQLite indexes for persistent queries. The interface displays useful results instead of an algorithm demonstration screen.”
