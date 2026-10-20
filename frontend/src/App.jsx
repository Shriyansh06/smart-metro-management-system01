import { useEffect, useState } from "react";
import {
  TrainFront,
  Route,
  Ticket,
  LayoutDashboard,
  Users,
  TriangleAlert,
  LogOut,
  ArrowUpRight,
  Radio,
} from "lucide-react";
import { api } from "./api";
import { Card } from "./components";
import Portal from "./Portal";
import Admin from "./Admin";

const navigation = [
  ["journey", "Plan a journey", Route],
  ["bookings", "My bookings", Ticket],
  ["dashboard", "Overview", LayoutDashboard, true],
  ["controls", "Stations & trains", TrainFront, true],
  ["queues", "Passenger queues", Users, true],
  ["emergencies", "Disruptions", TriangleAlert, true],
];

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("journey");
  const [network, setNetwork] = useState({
    stations: [],
    edges: [],
    blocked: [],
  });
  const [notice, setNotice] = useState(null);
  const [auth, setAuth] = useState(false);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const refresh = () => setVersion((value) => value + 1);
  const notify = (text, error = false) => setNotice({ text, error });

  useEffect(() => {
    api("/network")
      .then(setNetwork)
      .catch((error) => notify(error.message, true));
  }, [version]);
  useEffect(() => {
    if (sessionStorage.getItem("metro-token"))
      api("/auth/me")
        .then(setUser)
        .catch(() => sessionStorage.removeItem("metro-token"));
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(timer);
  }, [notice]);

  async function act(task) {
    setBusy(true);
    try {
      const result = await task();
      refresh();
      if (result?.message) notify(result.message);
      return result;
    } catch (error) {
      notify(error.message, true);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* Local logout still works offline. */
    }
    sessionStorage.removeItem("metro-token");
    setUser(null);
    setPage("journey");
    refresh();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(event) => {
            event.preventDefault();
            setPage("journey");
          }}
        >
          <span className="brand-icon">
            <TrainFront size={24} />
          </span>
          <span>
            smart<span className="font-normal">metro</span>
            <small>THE CITY, CONNECTED.</small>
          </span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation
            .filter((item) => !item[3] || user?.role === "admin")
            .map(([key, label, Icon]) => (
              <button
                key={key}
                className={page === key ? "nav-item active" : "nav-item"}
                onClick={() => setPage(key)}
              >
                <Icon size={19} />
                {label}
                {page === key && <span className="nav-dot" />}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="lab-promo">
            <TrainFront size={22} />
            <h3>A connected city.</h3>
            <p>Plan your route and stay informed about service changes.</p>
            <button onClick={() => setPage("journey")}>
              Find a route <ArrowUpRight size={16} />
            </button>
          </div>
          <p className="sidebar-caption">SMART METRO · STUDENT PROJECT</p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="system-status">
            <Radio size={14} />
            {network.blocked.length
              ? `${network.blocked.length} station disruptions`
              : "Network operational"}
          </span>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-500">
              Demo city / India
            </span>
            {user ? (
              <>
                <span className="avatar">{user.name[0]}</span>
                <span className="user-name">
                  {user.name}
                  <small>{user.role}</small>
                </span>
                <button
                  className="icon-button"
                  onClick={logout}
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <button className="button small" onClick={() => setAuth(true)}>
                Sign in
              </button>
            )}
          </div>
        </header>
        <main>
          {["journey", "bookings"].includes(page) ? (
            <Portal
              {...{ page, network, user, version, act, busy, notify }}
              signIn={() => setAuth(true)}
            />
          ) : user?.role === "admin" ? (
            <Admin {...{ page, network, version, act, busy, notify }} />
          ) : null}
        </main>
        <footer>
          Built for better journeys. Designed for learning.
          <span>React · FastAPI · SQLite</span>
        </footer>
      </div>
      {notice && (
        <div
          role={notice.error ? "alert" : "status"}
          className={`toast ${notice.error ? "error" : ""}`}
        >
          <span>{notice.text}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      )}
      {auth && (
        <AuthModal
          onClose={() => setAuth(false)}
          onLogin={(person) => {
            setUser(person);
            setAuth(false);
            refresh();
            notify(`Welcome, ${person.name}.`);
          }}
        />
      )}
    </div>
  );
}

function AuthModal({ onClose, onLogin }) {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("passenger@metro.local");
  const [password, setPassword] = useState("Passenger123!");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (register)
        await api("/auth/register", {
          method: "POST",
          body: { email, password, name },
        });
      const result = await api("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      sessionStorage.setItem("metro-token", result.token);
      onLogin(result.user);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <Card className="auth-modal">
        <div className="flex justify-between items-center">
          <h2>{register ? "Create your account" : "Welcome aboard."}</h2>
          <button
            className="icon-button"
            aria-label="Close sign in"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="subtitle">Your next journey starts here.</p>
        <form onSubmit={submit}>
          {register && (
            <label className="field">
              Name
              <input
                required
                minLength={2}
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          )}
          <label className="field">
            Email
            <input
              autoFocus
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              required
              minLength={register ? 8 : 1}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <button disabled={busy} className="button w-full">
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register
            ? "Already have an account? Sign in"
            : "New passenger? Create an account"}
        </button>
        {!register && (
          <div className="demo-logins">
            <p>Try a demo account</p>
            <button
              onClick={() => {
                setEmail("passenger@metro.local");
                setPassword("Passenger123!");
              }}
            >
              Passenger
            </button>
            <button
              onClick={() => {
                setEmail("admin@metro.local");
                setPassword("Admin123!");
              }}
            >
              Administrator
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
