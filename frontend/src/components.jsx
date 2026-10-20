import { useEffect, useState } from "react";
import { api } from "./api";
import { ArrowRight, TrainFront } from "lucide-react";

export function Card({ children, className = "" }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Heading({ eyebrow, title, children }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children && <p className="subtitle">{children}</p>}
      </div>
      <span className="demo-tag">ACADEMIC DEMO</span>
    </div>
  );
}

export function StationSelect({ network, label, value, onChange, ...props }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  useEffect(() => {
    let active = true;
    if (!query.trim()) {
      setMatches([]);
      return;
    }
    const timer = setTimeout(
      () =>
        api(`/stations/suggest?prefix=${encodeURIComponent(query.trim())}`)
          .then((rows) => {
            if (active) setMatches(rows);
          })
          .catch(() => {
            if (active) setMatches([]);
          }),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <div>
      <label className="field">
        {label} station search
        <input
          type="search"
          placeholder="Type a station prefix…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {query.trim() && (
        <div
          aria-label={`${label} suggestions`}
          className="station-suggestions"
        >
          {matches.map((station) => (
            <button
              type="button"
              key={station.id}
              onClick={() => {
                onChange(station.id);
                setQuery("");
              }}
            >
              {station.name}
            </button>
          ))}
          {matches.length === 0 && <small>No matching stations.</small>}
        </div>
      )}
      <label className="field">
        {label}
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          {...props}
        >
          {network.stations.map((station) => (
            <option key={station.id} value={station.id}>
              {station.name}
              {network.blocked.includes(station.id) ? " · closed" : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function NetworkMap({ network, path = [] }) {
  const stations = Object.fromEntries(
    network.stations.map((station) => [station.id, station]),
  );
  const colors = { Blue: "#4f87d7", Green: "#2da486", Amber: "#e6ad44" };
  const highlighted = (a, b) =>
    path.some(
      (value, index) =>
        index > 0 &&
        ((path[index - 1] === a && value === b) ||
          (path[index - 1] === b && value === a)),
    );
  return (
    <div className="map-wrap">
      <div className="flex items-center justify-between gap-3">
        <h3>Explore the network</h3>
        <span className="text-xs text-slate-500">
          {network.stations.length} stations · schematic map
        </span>
      </div>
      <svg
        className="network-map"
        viewBox="0 0 780 410"
        role="img"
        aria-label="Metro network map; closed stations are marked with a cross"
      >
        <defs>
          <pattern
            id="grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1" fill="#dce6e2" />
          </pattern>
        </defs>
        <rect width="780" height="410" fill="url(#grid)" />
        {network.edges.map((edge) => {
          const a = stations[edge.source],
            b = stations[edge.target];
          if (!a || !b) return null;
          const blocked =
            network.blocked.includes(a.id) || network.blocked.includes(b.id);
          return (
            <g key={edge.id}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={
                  highlighted(a.id, b.id)
                    ? "#075f54"
                    : colors[edge.line] || "#95a3ad"
                }
                strokeWidth={highlighted(a.id, b.id) ? 9 : 6}
                opacity={blocked ? 0.25 : 1}
                strokeDasharray={blocked ? "7 5" : ""}
                strokeLinecap="round"
              />
              <text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - 10}
                textAnchor="middle"
                className="map-time"
              >
                {edge.minutes}m
              </text>
            </g>
          );
        })}
        {network.stations.map((station) => (
          <g key={station.id}>
            <circle
              cx={station.x}
              cy={station.y}
              r={path.includes(station.id) ? 10 : 7}
              fill="white"
              stroke={
                network.blocked.includes(station.id) ? "#cc554d" : "#224a43"
              }
              strokeWidth="3"
            />
            {network.blocked.includes(station.id) && (
              <text
                x={station.x}
                y={station.y + 4}
                textAnchor="middle"
                fill="#b42318"
              >
                ×
              </text>
            )}
            <text
              x={station.x}
              y={station.y + 27}
              textAnchor="middle"
              className="map-label"
            >
              {station.name}
            </text>
          </g>
        ))}
      </svg>
      <div className="legend">
        {Object.entries(colors).map(([line, color]) => (
          <span key={line}>
            <i style={{ background: color }} />
            {line} line
          </span>
        ))}
        <span>
          <i style={{ background: "#cc554d" }} />
          Disrupted
        </span>
      </div>
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <TrainFront size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function RouteSummary({ route }) {
  return (
    <div>
      <div className="route-metrics">
        <div>
          <strong>
            {route.minutes}
            <small> min</small>
          </strong>
          <span>Travel time</span>
        </div>
        <div>
          <strong>₹{route.fare}</strong>
          <span>Per passenger</span>
        </div>
        <div>
          <strong>{route.transfers}</strong>
          <span>Line changes</span>
        </div>
      </div>
      <div className="route-stops">
        {route.names.map((name, index) => (
          <span key={name}>
            {index > 0 && <ArrowRight size={13} />}
            <b>{name}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
