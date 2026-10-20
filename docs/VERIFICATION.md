# Verification — crowd analytics version

Verified on 19 October 2026 on Windows, Python 3.13.15, Node 24.10.0 and headless Microsoft Edge.

- 12 backend tests passed: authentication/ownership, FIFO and concurrent boarding, routes and disruptions, station/train controls, India-time date boundaries, daily arrival totals, empty reports, stable station ranking, prefix search, closure-aware connectivity, and removed lab endpoints.
- 2 frontend API-client tests passed.
- Production Vite build passed.
- Browser workflow passed: station autocomplete, booking, admin login, disruption/rerouting, arrivals, boarding/alighting, daily crowd chart (13 arrivals), connectivity status, absence of lab navigation, mobile layout and no JavaScript page errors.
- The test database and test server are isolated from saved demo data.

The original lab-specific tests were removed with that feature; this report supersedes the previous 73-test report. One upstream Starlette/AnyIO deprecation warning remains non-failing.
