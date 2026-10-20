import { useEffect, useState } from "react";
import { api } from "./api";
import { Card } from "./components";

export default function Crowd({ version, notify }) {
  const [date, setDate] = useState(() =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  );
  const [report, setReport] = useState(null);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      api(`/analytics/crowd?day=${date}`)
        .then((data) => {
          if (active) setReport(data);
        })
        .catch((error) => {
          if (active) notify(error.message, true);
        });
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [date, version]);
  return (
    <Card className="mt-5">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <p className="eyebrow">PASSENGER ACTIVITY</p>
          <h2>Daily passenger crowd</h2>
          <p className="subtitle">
            Recorded simulation arrivals · India time · refreshes every 30
            seconds
          </p>
        </div>
        <label className="field">
          Report date
          <input
            type="date"
            required
            value={date}
            onChange={(e) => {
              if (e.target.value) {
                setReport(null);
                setDate(e.target.value);
              }
            }}
          />
        </label>
      </div>
      {report && (
        <>
          <div className="route-metrics">
            <div>
              <strong>{report.total}</strong>
              <span>Arrivals on selected date</span>
            </div>
            <div>
              <strong>{report.waiting_now}</strong>
              <span>Waiting right now (all dates)</span>
            </div>
            <div>
              <strong>
                {report.peak_hour === null
                  ? "—"
                  : `${String(report.peak_hour).padStart(2, "0")}:00`}
              </strong>
              <span>Peak arrival hour</span>
            </div>
          </div>
          <div
            className="crowd-chart"
            role="img"
            aria-label={`Hourly passenger arrivals; daily total ${report.total}`}
          >
            <svg viewBox="0 0 800 240">
              {[0, 1, 2, 3].map((n) => (
                <g key={n}>
                  <line
                    x1="35"
                    y1={190 - n * 50}
                    x2="790"
                    y2={190 - n * 50}
                    stroke="#e3ece6"
                  />
                  <text
                    x="25"
                    y={194 - n * 50}
                    textAnchor="end"
                    fontSize="10"
                    fill="#5c796c"
                  >
                    {Math.round(
                      (Math.max(3, ...report.hourly.map((h) => h.arrivals)) *
                        n) /
                        3,
                    )}
                  </text>
                </g>
              ))}
              {report.hourly.map(({ hour, arrivals }) => {
                const height =
                  (arrivals /
                    Math.max(3, ...report.hourly.map((h) => h.arrivals))) *
                  150;
                return (
                  <g key={hour}>
                    <title>
                      {String(hour).padStart(2, "0")}:00 — {arrivals} arrivals
                    </title>
                    <rect
                      x={40 + hour * 31}
                      y={190 - height}
                      width="21"
                      height={height}
                      fill="#26876c"
                      rx="3"
                    />
                    {hour % 3 === 0 && (
                      <text
                        x={50 + hour * 31}
                        y="212"
                        textAnchor="middle"
                        fontSize="11"
                        fill="#5c796c"
                      >
                        {String(hour).padStart(2, "0")}:00
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          {report.total === 0 && (
            <p className="subtitle">
              No arrivals recorded on this date. Add passengers in Passenger
              queues to see today's activity.
            </p>
          )}
          <details>
            <summary>Hourly passenger totals</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Hour (IST)</th>
                    <th>Arrivals</th>
                  </tr>
                </thead>
                <tbody>
                  {report.hourly.map((h) => (
                    <tr key={h.hour}>
                      <td>{String(h.hour).padStart(2, "0")}:00</td>
                      <td>{h.arrivals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <div className="admin-grid mt-5">
            <div>
              <h3>Busiest stations by arrivals</h3>
              {report.stations.map((s) => (
                <div key={s.id} className="mt-3">
                  <div className="flex justify-between text-xs">
                    <span>{s.name}</span>
                    <b>{s.arrivals}</b>
                  </div>
                  <div className="bar-track">
                    <div
                      style={{
                        width: `${(s.arrivals / Math.max(1, ...report.stations.map((x) => x.arrivals))) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <h3>Network connectivity</h3>
              <p className="subtitle">
                {report.components.length === 0
                  ? "No stations currently available."
                  : report.components.length === 1
                    ? "All available stations are connected."
                    : `${report.components.length} separate service areas. Journeys between areas are unavailable.`}
              </p>
              <p className="subtitle">
                {report.closed_stations} closed stations excluded.
              </p>
              {report.components.map((group, i) => (
                <p key={i} className="notice-inline">
                  Service area {i + 1}: {group.join(", ")}
                </p>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
