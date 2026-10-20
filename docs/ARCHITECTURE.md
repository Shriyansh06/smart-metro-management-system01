# Architecture

React/Tailwind → same-origin FastAPI endpoints → SQLite.

- `main.py`: validation, authentication, admin permissions, bookings, queues, trains and incidents.
- `database.py`: schema, sample data, SQLite indexes and password hashes.
- `routing.py`: weighted graph routing with closure filtering.
- `analytics.py`: India-time arrival aggregation, merge-sort station ranking, trie suggestions and union-find connectivity.
- `structures.py`: the operational trie and disjoint-set implementations.
- `Crowd.jsx`: admin charts and date selection; refreshes every 30 seconds.
- `Portal.jsx`, `Admin.jsx`, `components.jsx`: passenger portal, operations and reusable station-search controls.

Bookings and queue passengers are separate simulation concepts. Crowds count actual passenger rows, not bookings. SQL writes commit on success and roll back on failure. Boarding uses an immediate transaction to prevent duplicate boarding or overfilling trains.

Any active incident closes its station. Resolving one incident does not override another active incident or a manually disabled station. Existing bookings retain original fares and display current route availability.

The removed lab endpoints return 404. No lab screen or algorithm comparison UI remains. See SYLLABUS.md for precise operational syllabus mapping and limitations.
