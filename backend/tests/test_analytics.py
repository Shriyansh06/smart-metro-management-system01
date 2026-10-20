from datetime import date
from app.analytics import crowd_report, merge_rank, station_suggestions
from app.database import connect


def test_india_day_boundaries_and_boarded_passengers(client):
    with connect() as db:
        db.execute('DELETE FROM passengers')
        for timestamp,status in [('2026-10-18 18:29:59','waiting'),('2026-10-18 18:30:00','waiting'),('2026-10-19 18:29:59','boarded'),('2026-10-19 18:30:00','waiting')]:
            db.execute('INSERT INTO passengers(station_id,name,status,created) VALUES (1,?,?,?)',('Test',status,timestamp))
        report=crowd_report(db,date(2026,10,19))
    assert report['total']==2
    assert report['hourly'][0]['arrivals']==1
    assert report['hourly'][23]['arrivals']==1
    assert sum(row['arrivals'] for row in report['stations'])==2
    assert report['waiting_now']==3


def test_report_access_empty_day_and_removed_lab(client,admin,passenger):
    assert client.get('/api/analytics/crowd').status_code==401
    assert client.get('/api/analytics/crowd',headers=passenger).status_code==403
    report=client.get('/api/analytics/crowd?day=2000-01-01',headers=admin).json()
    assert report['total']==0 and report['peak_hour'] is None
    assert len(report['hourly'])==24
    assert client.get('/api/analytics/crowd?day=invalid',headers=admin).status_code==422
    assert client.get('/api/lab/catalog').status_code==404
    assert client.post('/api/lab/run',json={}).status_code==404


def test_trie_lookup_and_merge_sort(client):
    assert client.get('/api/stations/suggest?prefix=un').json()==[{'id':3,'name':'University'}]
    assert client.get('/api/stations/suggest?prefix=zz').json()==[]
    rows=[{'name':'a','arrivals':2},{'name':'b','arrivals':4},{'name':'c','arrivals':2}]
    assert [r['name'] for r in merge_rank(rows)]==['b','a','c']
    assert rows[0]['name']=='a'
    with connect() as db:
        db.execute("INSERT INTO stations(name,x,y) VALUES ('Market $ Gate',100,100)")
        assert station_suggestions(db,'market $')[0]['name']=='Market $ Gate'


def test_connectivity_responds_to_closure(client,admin):
    report=client.get('/api/analytics/crowd',headers=admin).json()
    assert len(report['components'])==1
    client.post('/api/incidents',headers=admin,json={'station_id':3,'title':'Signal fault','severity':5})
    report=client.get('/api/analytics/crowd',headers=admin).json()
    assert len(report['components'])==2
    assert ['North Gate'] in report['components']
    assert report['closed_stations']==1
