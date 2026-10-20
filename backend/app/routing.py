"""Weighted metro routing. Blocked stations are removed before Dijkstra runs."""

import heapq


def network(db):
    stations = [dict(row) for row in db.execute("SELECT * FROM stations ORDER BY id")]
    edges = [dict(row) for row in db.execute("SELECT * FROM edges ORDER BY id")]
    blocked = {
        r[0]
        for r in db.execute("SELECT station_id FROM incidents WHERE status='active'")
    }
    blocked.update(s["id"] for s in stations if not s["active"])
    return stations, edges, blocked


def shortest_route(db, origin, destination):
    stations, edges, blocked = network(db)
    names = {s["id"]: s["name"] for s in stations}
    if origin not in names or destination not in names:
        raise ValueError("Choose valid stations.")
    if origin == destination:
        raise ValueError("Choose two different stations.")
    if origin in blocked or destination in blocked:
        raise ValueError("The origin or destination is currently closed.")
    adjacency = {key: [] for key in names if key not in blocked}
    for edge in edges:
        a, b = edge["source"], edge["target"]
        if a in adjacency and b in adjacency:
            adjacency[a].append((b, edge["minutes"], edge["line"]))
            adjacency[b].append((a, edge["minutes"], edge["line"]))
    frontier = [(0, origin, [], [])]
    best = {origin: 0}
    visited = []
    while frontier:
        cost, node, path, lines = heapq.heappop(frontier)
        if cost != best[node]:
            continue
        visited.append(node)
        path = path + [node]
        if node == destination:
            return dict(
                path=path,
                names=[names[n] for n in path],
                minutes=cost,
                fare=10 + 5 * (len(path) - 1),
                lines=lines,
                transfers=sum(a != b for a, b in zip(lines, lines[1:])),
                visited=visited,
            )
        for neighbor, weight, line in adjacency[node]:
            if cost + weight < best.get(neighbor, float("inf")):
                best[neighbor] = cost + weight
                heapq.heappush(
                    frontier, (cost + weight, neighbor, path, lines + [line])
                )
    raise ValueError(
        "No route is available. Try again after the disruption is resolved."
    )
