import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowDownUp,
  Clock3,
  ShieldCheck,
  MapPin,
  Ticket,
} from "lucide-react";
import { api } from "./api";
import {
  Card,
  Empty,
  Heading,
  NetworkMap,
  RouteSummary,
  StationSelect,
} from "./components";

export default function Portal({
  page,
  network,
  user,
  version,
  act,
  busy,
  notify,
  signIn,
}) {
  const [origin, setOrigin] = useState(1),
    [destination, setDestination] = useState(5);
  const [count, setCount] = useState(1),
    [route, setRoute] = useState(null),
    [searching, setSearching] = useState(false);
  const [bookings, setBookings] = useState([]),
    [loading, setLoading] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [receipt, setReceipt] = useState(null);
  useEffect(() => {
    setRoute(null);
  }, [origin, destination, version]);
  useEffect(() => {
    setReceipt(null);
  }, [origin, destination]);
  useEffect(() => {
    api("/incidents")
      .then(setIncidents)
      .catch((error) => notify(error.message, true));
  }, [version]);
  useEffect(() => {
    if (user && page === "bookings") {
      setLoading(true);
      api("/bookings")
        .then(setBookings)
        .catch((error) => notify(error.message, true))
        .finally(() => setLoading(false));
    }
  }, [user, page, version]);
  async function findRoute(event) {
    event.preventDefault();
    setSearching(true);
    setReceipt(null);
    try {
      setRoute(
        await api(`/routes?origin=${origin}&destination=${destination}`),
      );
    } catch (error) {
      setRoute(null);
      notify(error.message, true);
    } finally {
      setSearching(false);
    }
  }
  async function book() {
    if (!user) {
      signIn();
      return;
    }
    const result = await act(() =>
      api("/bookings", {
        method: "POST",
        body: { origin, destination, passengers: count },
      }),
    );
    if (result) {
      setReceipt(result);
      notify(`Booking confirmed: ${result.reference}`);
    }
  }
  const stationName = (id) =>
    network.stations.find((station) => station.id === id)?.name ||
    `Station ${id}`;
  if (page === "bookings")
    return (
      <>
        <Heading
          eyebrow="PASSENGER PORTAL"
          title="Your journeys, all in one place."
        >
          Manage your tickets and check current route availability.
        </Heading>
        {!user ? (
          <Card>
            <Empty title="Sign in to see your bookings">
              Your confirmed and cancelled journeys will appear here.
            </Empty>
            <button className="button" onClick={signIn}>
              Sign in
            </button>
          </Card>
        ) : loading ? (
          <Card>Loading bookings…</Card>
        ) : bookings.length === 0 ? (
          <Card>
            <Empty title="Your first journey is waiting">
              Plan a route and book a demo ticket to get started.
            </Empty>
          </Card>
        ) : (
          <div className="grid gap-4">
            {bookings.map((booking) => (
              <Card key={booking.id}>
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <p className="eyebrow">{booking.reference}</p>
                    <h3>
                      {stationName(booking.origin)} →{" "}
                      {stationName(booking.destination)}
                    </h3>
                    <p className="subtitle">
                      {booking.passengers} passenger(s) · ₹{booking.fare} ·{" "}
                      {booking.created} UTC
                    </p>
                  </div>
                  <span
                    className={`badge ${booking.status === "cancelled" ? "neutral" : ""}`}
                  >
                    {booking.status}
                  </span>
                </div>
                {booking.status === "confirmed" && (
                  <>
                    {booking.current_route ? (
                      <>
                        <p className="notice-inline">
                          {booking.rerouted
                            ? "Service change: use the updated route below. Your original fare is retained."
                            : "Current route is available."}
                        </p>
                        <RouteSummary route={booking.current_route} />
                      </>
                    ) : (
                      <p className="error-text">{booking.route_notice}</p>
                    )}
                    <button
                      className="button secondary mt-4"
                      disabled={busy}
                      onClick={() =>
                        act(() =>
                          api(`/bookings/${booking.id}/cancel`, {
                            method: "POST",
                          }),
                        )
                      }
                    >
                      Cancel booking
                    </button>
                  </>
                )}
              </Card>
            ))}
          </div>
        )}
      </>
    );
  return (
    <>
      <Heading
        eyebrow="MOVE SMARTER. EVERY DAY."
        title="Your city. One seamless journey."
      >
        Find the quickest route, skip the guesswork, and get where you need to
        be.
      </Heading>
      <div className="journey-grid">
        <Card className="planner">
          <div className="section-title">
            <span className="soft-icon">
              <MapPin size={20} />
            </span>
            <h2>Where are we going?</h2>
          </div>
          <form onSubmit={findRoute}>
            <StationSelect
              network={network}
              label="FROM"
              value={origin}
              onChange={setOrigin}
            />
            <button
              type="button"
              className="swap-button"
              aria-label="Swap origin and destination"
              onClick={() => {
                setOrigin(destination);
                setDestination(origin);
              }}
            >
              <ArrowDownUp size={17} />
            </button>
            <StationSelect
              network={network}
              label="TO"
              value={destination}
              onChange={setDestination}
            />
            <label className="field">
              PASSENGERS
              <select
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
              >
                {Array.from({ length: 8 }, (_, index) => (
                  <option key={index + 1}>{index + 1}</option>
                ))}
              </select>
            </label>
            <button
              className="button w-full"
              disabled={searching || !network.stations.length}
            >
              {searching ? "Finding your route…" : "Find my route"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="planner-foot">
            <ShieldCheck size={14} /> Routes adapt to active disruptions.
          </p>
        </Card>
        <Card className="map-card">
          <NetworkMap network={network} path={route?.path || []} />
          <div className="map-caption">
            <span className="pulse-dot" /> A connected city, at a glance.
            <span>Travel times in minutes</span>
          </div>
        </Card>
      </div>
      {route && (
        <Card className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow">YOUR RECOMMENDED ROUTE</p>
              <h2>
                {route.names[0]} to {route.names.at(-1)}
              </h2>
            </div>
            <button className="button" disabled={busy} onClick={book}>
              <Ticket size={17} />
              {user
                ? `Book journey · ₹${route.fare * count}`
                : "Sign in to book"}
            </button>
          </div>
          <RouteSummary route={route} />
          <p className="text-xs text-slate-500 mt-3">
            Demo travel ticket; no payment is collected. Travel time excludes
            waiting and transfer dwell time.
          </p>
        </Card>
      )}
      {receipt && (
        <Card className="mt-5">
          <h3>Journey booked · {receipt.reference}</h3>
          <p>
            Find your ticket under My bookings. Total demo fare: ₹
            {receipt.total}.
          </p>
        </Card>
      )}
      <div className="feature-grid">
        <Card>
          <span className="soft-icon">
            <Clock3 size={20} />
          </span>
          <h3>Less time figuring it out.</h3>
          <p>
            Weighted route planning finds the fastest available journey across
            the network.
          </p>
        </Card>
        <Card>
          <span className="soft-icon amber">
            <ShieldCheck size={20} />
          </span>
          <h3>Stay one step ahead.</h3>
          <p>
            {incidents.filter((item) => item.status === "active").length
              ? incidents
                  .filter((item) => item.status === "active")
                  .map(
                    (item) => `${stationName(item.station_id)}: ${item.title}`,
                  )
                  .join(" · ")
              : "No active disruptions. All services in the demo network are available."}
          </p>
        </Card>
        <Card className="dark-card">
          <p className="eyebrow">TRAVEL WITH CONFIDENCE</p>
          <h3>
            Your next stop,
            <br />a little closer.
          </h3>
          <p>
            Find available routes, check travel times, and manage your bookings
            in one place.
          </p>
          <span className="code-pill">Your city, connected.</span>
        </Card>
      </div>
    </>
  );
}
