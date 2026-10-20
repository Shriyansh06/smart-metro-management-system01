"""Passenger reporting and operational data structures, without a teaching lab."""
from datetime import datetime, timedelta, timezone
from .routing import network
from .structures import DisjointSet, Trie

IST = timezone(timedelta(hours=5, minutes=30))


def merge_rank(rows):
    """Stable merge sort: busiest first, retaining station order for ties."""
    if len(rows) <= 1:
        return rows[:]
    middle = len(rows) // 2
    left, right = merge_rank(rows[:middle]), merge_rank(rows[middle:])
    output = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i]['arrivals'] >= right[j]['arrivals']:
            output.append(left[i]); i += 1
        else:
            output.append(right[j]); j += 1
    return output + left[i:] + right[j:]


def crowd_report(db, day):
    start = datetime.combine(day, datetime.min.time(), IST).astimezone(timezone.utc)
    end = start + timedelta(days=1)
    hourly = [0] * 24
    stations, edges, blocked = network(db)
    counts = {s['id']: dict(id=s['id'], name=s['name'], arrivals=0) for s in stations}
    for row in db.execute('SELECT station_id,created FROM passengers WHERE created>=? AND created<?',
                          (start.strftime('%Y-%m-%d %H:%M:%S'), end.strftime('%Y-%m-%d %H:%M:%S'))):
        hour = datetime.fromisoformat(row['created']).replace(tzinfo=timezone.utc).astimezone(IST).hour
        hourly[hour] += 1
        if row['station_id'] in counts:
            counts[row['station_id']]['arrivals'] += 1
    available = [s['id'] for s in stations if s['id'] not in blocked]
    sets = DisjointSet(available)
    for edge in edges:
        if edge['source'] in sets.parent and edge['target'] in sets.parent:
            sets.union(edge['source'], edge['target'])
    groups = {}
    for station_id in available:
        groups.setdefault(sets.find(station_id), []).append(counts[station_id]['name'])
    total = sum(hourly)
    return dict(date=day.isoformat(), timezone='Asia/Kolkata', total=total,
                hourly=[dict(hour=h, arrivals=n) for h,n in enumerate(hourly)],
                peak_hour=hourly.index(max(hourly)) if total else None,
                stations=merge_rank(list(counts.values())), components=list(groups.values()),
                closed_stations=len(blocked),
                waiting_now=db.execute("SELECT COUNT(*) FROM passengers WHERE status='waiting'").fetchone()[0])


def station_suggestions(db, prefix):
    trie = Trie()
    names = {}
    for row in db.execute('SELECT id,name FROM stations ORDER BY id'):
        key = row['name'].casefold()
        # Escape the trie terminal marker from user-editable station names.
        key = key.replace('$', '\uFF04')
        trie.insert(key)
        names[key] = dict(row)
    return [names[key] for key in trie.autocomplete(prefix.casefold().replace('$','\uFF04'))[:12]]
