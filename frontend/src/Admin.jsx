import { useEffect, useState } from "react";
import {
  Activity,
  Ticket,
  TrainFront,
  Users,
  IndianRupee,
  TriangleAlert,
  Plus,
  ArrowRight,
} from "lucide-react";
import { api } from "./api";
import Crowd from "./Crowd";
import { Card, Empty, Heading, NetworkMap, StationSelect } from "./components";

export default function Admin({ page, network, version, act, busy, notify }) {
  const [dashboard, setDashboard] = useState(null),
    [trains, setTrains] = useState([]),
    [incidents, setIncidents] = useState([]);
  const [station, setStation] = useState(1),
    [queue, setQueue] = useState([]),
    [count, setCount] = useState(5);
  const [train, setTrain] = useState({
      name: "",
      station_id: 1,
      capacity: 60,
      status: "running",
    }),
    [editing, setEditing] = useState(null);
  const [newStation, setNewStation] = useState({
    name: "",
    x: 100,
    y: 65,
    active: true,
  });
  const [connection, setConnection] = useState({
    source: 1,
    target: 2,
    minutes: 4,
    line: "Blue",
  });
  const [incident, setIncident] = useState({
    station_id: 3,
    title: "",
    severity: 3,
  });
  useEffect(() => {
    Promise.all([api("/dashboard"), api("/trains"), api("/incidents")])
      .then(([summary, fleet, alerts]) => {
        setDashboard(summary);
        setTrains(fleet);
        setIncidents(alerts);
      })
      .catch((error) => notify(error.message, true));
  }, [version]);
  useEffect(() => {
    if (page === "queues")
      api(`/queues?station_id=${station}`)
        .then(setQueue)
        .catch((error) => notify(error.message, true));
  }, [page, station, version]);
  const name = (id) =>
    network.stations.find((item) => item.id === id)?.name || id;
  const changeTrain = (key, value) =>
    setTrain((current) => ({ ...current, [key]: value }));
  const changeStation = (key, value) =>
    setNewStation((current) => ({ ...current, [key]: value }));
  async function saveTrain(event) {
    event.preventDefault();
    const result = await act(() =>
      api(editing ? `/trains/${editing}` : "/trains", {
        method: editing ? "PUT" : "POST",
        body: train,
      }),
    );
    if (result) {
      setEditing(null);
      setTrain({ name: "", station_id: 1, capacity: 60, status: "running" });
    }
  }
  if (page === "dashboard")
    return (
      <>
        <Heading
          eyebrow="OPERATIONS / OVERVIEW"
          title="A clear view of your city."
        >
          Passenger flow, services, and network health in one place.
        </Heading>
        {dashboard && (
          <>
            <div className="stats-grid">
              {[
                [TrainFront, dashboard.trains, "Trains running"],
                [Activity, dashboard.stations, "Enabled stations"],
                [Users, dashboard.waiting, "Passengers waiting"],
                [Ticket, dashboard.bookings, "Active bookings"],
              ].map(([Icon, value, label]) => (
                <Card key={label}>
                  <div className="stat-label">
                    <span>{label}</span>
                    <Icon size={18} />
                  </div>
                  <strong className="stat-value">{value}</strong>
                  <span className="stat-sub">From the current simulation</span>
                </Card>
              ))}
            </div>
            <Crowd version={version} notify={notify} />
            <div className="admin-grid mt-5">
              <Card className="map-card">
                <NetworkMap network={network} />
              </Card>
              <Card>
                <p className="eyebrow">PLATFORM ACTIVITY</p>
                <h2>Where the city waits</h2>
                <div className="queue-chart">
                  {dashboard.queues.map((item) => (
                    <div key={item.name}>
                      <div className="flex justify-between">
                        <span>{item.name}</span>
                        <b>{item.waiting}</b>
                      </div>
                      <div className="bar-track">
                        <div
                          style={{
                            width: `${(item.waiting / Math.max(1, ...dashboard.queues.map((q) => q.waiting))) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <div className="grid md:grid-cols-2 gap-5 mt-5">
              <Card>
                <IndianRupee size={20} />
                <h3 className="mt-3">
                  ₹{dashboard.revenue} in confirmed demo fares
                </h3>
                <p className="subtitle">
                  Cancelled bookings are excluded. No real payments are
                  collected.
                </p>
              </Card>
              <Card>
                <TriangleAlert size={20} />
                <h3 className="mt-3">
                  {dashboard.incidents} active disruptions
                </h3>
                <p className="subtitle">
                  Affected stations are excluded from passenger route planning.
                </p>
              </Card>
            </div>
          </>
        )}
      </>
    );
  if (page === "queues")
    return (
      <>
        <Heading
          eyebrow="OPERATIONS / PASSENGER FLOW"
          title="Keep the platform moving."
        >
          Add arrivals, board in FIFO order, and watch train capacity update.
        </Heading>
        <div className="admin-grid">
          <Card>
            <h2>Arrival simulator</h2>
            <StationSelect
              network={network}
              label="Station"
              value={station}
              onChange={setStation}
            />
            <label className="field">
              New arrivals
              <input
                type="number"
                min="1"
                max="100"
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
              />
            </label>
            <button
              className="button"
              disabled={busy || count < 1 || count > 100}
              onClick={() =>
                act(() =>
                  api("/queues/arrive", {
                    method: "POST",
                    body: { station_id: station, count },
                  }),
                )
              }
            >
              <Plus size={17} />
              Simulate arrivals
            </button>
            <p className="subtitle mt-4">
              Each click adds a batch. Queue order and boarding are saved in
              SQLite.
            </p>
            <div className="queue-people mt-5">
              {queue.map((person, index) => (
                <div className="person" key={person.id}>
                  <Users size={19} />
                  <b>#{person.id}</b>
                  <small>{index === 0 ? "NEXT TO BOARD" : person.name}</small>
                </div>
              ))}
            </div>
            {queue.length === 0 && (
              <Empty title="Platform clear">
                Add passengers to start the simulation.
              </Empty>
            )}
            <div className="queue-total">
              {queue.length} waiting <ArrowRight size={16} /> FIFO boarding
            </div>
          </Card>
          <div>
            <h2 className="mb-4">Trains at {name(station)}</h2>
            {trains
              .filter((item) => item.station_id === station)
              .map((item) => (
                <Card key={item.id} className="mb-4">
                  <div className="flex justify-between">
                    <h3>{item.name}</h3>
                    <span className="badge">{item.status}</span>
                  </div>
                  <p className="subtitle">
                    {item.onboard} / {item.capacity} passengers onboard
                  </p>
                  <div className="bar-track my-4">
                    <div
                      style={{
                        width: `${(item.onboard / item.capacity) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={busy || item.status !== "running"}
                      className="button"
                      onClick={() =>
                        act(() =>
                          api(`/trains/${item.id}/board`, { method: "POST" }),
                        )
                      }
                    >
                      Board passengers
                    </button>
                    <button
                      disabled={busy || !item.onboard}
                      className="button secondary"
                      onClick={() =>
                        act(() =>
                          api(`/trains/${item.id}/alight`, { method: "POST" }),
                        )
                      }
                    >
                      Alight all
                    </button>
                  </div>
                </Card>
              ))}
            {!trains.some((item) => item.station_id === station) && (
              <Card>
                <Empty title="No train at this station">
                  Move a train here using Stations & trains.
                </Empty>
              </Card>
            )}
            <Card className="mt-4">
              <p className="eyebrow">WHY A QUEUE?</p>
              <h3>First in, first onboard.</h3>
              <p className="subtitle">
                Arrivals join the tail; boarding removes from the head. A single
                database transaction prevents two boarding requests from taking
                the same seat.
              </p>
            </Card>
          </div>
        </div>
      </>
    );
  if (page === "emergencies")
    return (
      <>
        <Heading
          eyebrow="OPERATIONS / SERVICE HEALTH"
          title="Respond quickly. Keep people moving."
        >
          Priority 5 is most urgent. Equal-priority incidents follow arrival
          order.
        </Heading>
        <div className="admin-grid">
          <Card>
            <h2>Report a disruption</h2>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const result = await act(() =>
                  api("/incidents", { method: "POST", body: incident }),
                );
                if (result) setIncident({ ...incident, title: "" });
              }}
            >
              <StationSelect
                network={network}
                label="Affected station"
                value={incident.station_id}
                onChange={(value) =>
                  setIncident({ ...incident, station_id: value })
                }
              />
              <label className="field">
                Description
                <input
                  required
                  minLength={3}
                  maxLength={120}
                  placeholder="e.g. Signal fault at University"
                  value={incident.title}
                  onChange={(event) =>
                    setIncident({ ...incident, title: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Priority
                <select
                  value={incident.severity}
                  onChange={(event) =>
                    setIncident({
                      ...incident,
                      severity: Number(event.target.value),
                    })
                  }
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} ·{" "}
                      {
                        ["", "Low", "Moderate", "High", "Severe", "Critical"][
                          value
                        ]
                      }
                    </option>
                  ))}
                </select>
              </label>
              <button className="button" disabled={busy}>
                Report & reroute
              </button>
            </form>
            <p className="subtitle mt-4">
              Any active incident closes its station to routing and boarding.
              Resolve every incident at a station to reopen it, provided it is
              enabled.
            </p>
          </Card>
          <div className="grid gap-4 content-start">
            {incidents.length === 0 && (
              <Card>
                <Empty title="All clear">
                  Disruptions will appear here in priority order.
                </Empty>
              </Card>
            )}
            {incidents.map((item) => (
              <Card key={item.id}>
                <div className="flex justify-between gap-3">
                  <span
                    className={`badge ${item.status === "resolved" ? "neutral" : "warning"}`}
                  >
                    P{item.severity} · {item.status}
                  </span>
                  <span className="text-xs text-slate-500">#{item.id}</span>
                </div>
                <h3 className="mt-3">{item.title}</h3>
                <p className="subtitle">
                  {name(item.station_id)} · {item.created} UTC
                </p>
                {item.status === "active" && (
                  <button
                    disabled={busy}
                    className="button secondary mt-4"
                    onClick={() =>
                      act(() =>
                        api(`/incidents/${item.id}/resolve`, {
                          method: "POST",
                        }),
                      )
                    }
                  >
                    Resolve incident
                  </button>
                )}
              </Card>
            ))}
          </div>
        </div>
      </>
    );
  return (
    <>
      <Heading
        eyebrow="OPERATIONS / NETWORK CONTROLS"
        title="Build a network that works."
      >
        Manage stations, connections, and the demo train fleet.
      </Heading>
      <div className="admin-grid">
        <Card>
          <h2>Stations</h2>
          <div className="station-list">
            {network.stations.map((item) => (
              <div key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {network.blocked.includes(item.id)
                      ? "Closed / disrupted"
                      : "Open"}
                  </small>
                </div>
                <button
                  className="button secondary small"
                  disabled={busy}
                  onClick={() =>
                    act(() =>
                      api(`/stations/${item.id}`, {
                        method: "PUT",
                        body: { ...item, active: !item.active },
                      }),
                    )
                  }
                >
                  {item.active ? "Disable" : "Enable"}
                </button>
              </div>
            ))}
          </div>
          <h3 className="mt-6">Add a station</h3>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const result = await act(() =>
                api("/stations", { method: "POST", body: newStation }),
              );
              if (result) changeStation("name", "");
            }}
          >
            <label className="field">
              Station name
              <input
                required
                minLength={2}
                maxLength={50}
                value={newStation.name}
                onChange={(event) => changeStation("name", event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              {["x", "y"].map((key) => (
                <label className="field" key={key}>
                  Map {key.toUpperCase()}
                  <input
                    type="number"
                    required
                    min="40"
                    max={key === "x" ? 720 : 350}
                    value={newStation[key]}
                    onChange={(event) =>
                      changeStation(key, Number(event.target.value))
                    }
                  />
                </label>
              ))}
            </div>
            <button className="button" disabled={busy}>
              Add station
            </button>
          </form>
        </Card>
        <Card>
          <h2>{editing ? "Edit train" : "Add a train"}</h2>
          <form onSubmit={saveTrain}>
            <label className="field">
              Train name
              <input
                required
                minLength={2}
                maxLength={40}
                value={train.name}
                onChange={(event) => changeTrain("name", event.target.value)}
              />
            </label>
            <StationSelect
              network={network}
              label="Current station"
              value={train.station_id}
              onChange={(value) => changeTrain("station_id", value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="field">
                Capacity
                <input
                  required
                  type="number"
                  min="1"
                  max="1000"
                  value={train.capacity}
                  onChange={(event) =>
                    changeTrain("capacity", Number(event.target.value))
                  }
                />
              </label>
              <label className="field">
                Status
                <select
                  value={train.status}
                  onChange={(event) =>
                    changeTrain("status", event.target.value)
                  }
                >
                  <option value="running">Running</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </label>
            </div>
            <div className="flex gap-2">
              <button disabled={busy} className="button">
                {editing ? "Save train" : "Add train"}
              </button>
              {editing && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setEditing(null);
                    setTrain({
                      name: "",
                      station_id: 1,
                      capacity: 60,
                      status: "running",
                    });
                  }}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
          <div className="station-list mt-5">
            {trains.map((item) => (
              <div key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {name(item.station_id)} · {item.onboard}/{item.capacity} ·{" "}
                    {item.status}
                  </small>
                </div>
                <button
                  className="button secondary small"
                  onClick={() => {
                    setEditing(item.id);
                    setTrain(item);
                  }}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="mt-5">
        <h2>Track connections</h2>
        <form
          className="connection-form"
          onSubmit={(event) => {
            event.preventDefault();
            act(() =>
              api("/connections", { method: "POST", body: connection }),
            );
          }}
        >
          <StationSelect
            network={network}
            label="From station"
            value={connection.source}
            onChange={(value) =>
              setConnection({ ...connection, source: value })
            }
          />
          <StationSelect
            network={network}
            label="To station"
            value={connection.target}
            onChange={(value) =>
              setConnection({ ...connection, target: value })
            }
          />
          <label className="field">
            Minutes
            <input
              type="number"
              required
              min="1"
              max="120"
              value={connection.minutes}
              onChange={(event) =>
                setConnection({
                  ...connection,
                  minutes: Number(event.target.value),
                })
              }
            />
          </label>
          <label className="field">
            Line
            <select
              value={connection.line}
              onChange={(event) =>
                setConnection({ ...connection, line: event.target.value })
              }
            >
              {["Blue", "Green", "Amber"].map((line) => (
                <option key={line}>{line}</option>
              ))}
            </select>
          </label>
          <button disabled={busy} className="button">
            Connect
          </button>
        </form>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Connection</th>
                <th>Line</th>
                <th>Travel time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {network.edges.map((edge) => (
                <tr key={edge.id}>
                  <td>
                    {name(edge.source)} ↔ {name(edge.target)}
                  </td>
                  <td>{edge.line}</td>
                  <td>{edge.minutes} min</td>
                  <td>
                    <button
                      disabled={busy}
                      className="text-button danger"
                      onClick={() =>
                        act(() =>
                          api(`/connections/${edge.id}`, { method: "DELETE" }),
                        )
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
