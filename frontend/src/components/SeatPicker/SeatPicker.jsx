import { Component, Fragment, lazy, Suspense, useEffect, useMemo, useState } from "react";
import { MAX_SEATS, normalizeSeats, togetherNote, viewStats } from "./seatMath";
import "./SeatPicker.css";

// lazy: three.js only downloads when the customer actually switches to the 3D view
const SeatView3D = lazy(() => import("./SeatView3D"));

// If the device has no WebGL, show a message instead of crashing the whole page.
class View3DBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.error("3D seat view failed:", err);
  }
  render() {
    if (this.state.failed) {
      return <div className="sp-pov sp-pov-msg">3D view isn't available on this device. Switch to 2D Flat.</div>;
    }
    return this.props.children;
  }
}

/**
 * Props
 *  seats      raw seats from your API (re-render with new data when your WebSocket updates them)
 *  onConfirm  async (selectedSeats) => void. Call your booking API here and navigate on success.
 *             Throw an Error to show its message under the seat map.
 *  mode       "2d" (default, flat map only) or "3d" (adds the first-person 3D preview in the bottom sheet)
 *  busy       optional, disables the buttons while the parent is working
 *  adapt      optional, custom seat adapter (see seatMath.defaultAdapt)
 *  currency   default "RM"
 */
export default function SeatPicker({ seats: rawSeats, onConfirm, mode = "2d", busy = false, adapt, currency = "RM", maxSeats = MAX_SEATS }) {
  const seats = useMemo(() => normalizeSeats(rawSeats, adapt), [rawSeats, adapt]);
  const byId = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);
  const rows = useMemo(() => {
    const m = new Map();
    seats.forEach((s) => m.set(s.row, [...(m.get(s.row) || []), s]));
    return [...m.values()].sort((a, b) => a[0].rowIndex - b[0].rowIndex).map((r) => r.sort((a, b) => a.number - b.number));
  }, [seats]);

  const [selectedIds, setSelectedIds] = useState([]);
  const [focusId, setFocusId] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // If someone else takes a seat you picked (WebSocket update), drop it and say so.
  useEffect(() => {
    const gone = selectedIds.filter((id) => {
      const s = byId.get(id);
      return !s || s.status !== "AVAILABLE";
    });
    if (gone.length) {
      setSelectedIds((ids) => ids.filter((id) => !gone.includes(id)));
      setMessage("A seat you picked was just taken, so it was removed.");
    }
  }, [byId, selectedIds]);

  const selected = selectedIds.map((id) => byId.get(id)).filter(Boolean);
  const focusSeat = (selectedIds.includes(focusId) && byId.get(focusId)) || selected[selected.length - 1] || null;
  const stats = focusSeat ? viewStats(focusSeat) : null;
  const total = selected.reduce((sum, s) => sum + s.price, 0);
  const locked = busy || submitting;
  const is3D = mode === "3d";

  function toggle(seat) {
    if (locked) return;
    setMessage("");
    if (selectedIds.includes(seat.id)) {
      const rest = selectedIds.filter((id) => id !== seat.id);
      setSelectedIds(rest);
      setFocusId(rest.length ? rest[rest.length - 1] : null);
    } else if (selectedIds.length >= maxSeats) {
      setMessage(`You can book up to ${maxSeats} seats at a time.`);
    } else {
      setSelectedIds([...selectedIds, seat.id]);
      setFocusId(seat.id);
    }
  }

  async function confirm() {
    setSubmitting(true);
    setMessage("");
    try {
      await onConfirm(selected);
    } catch (err) {
      setMessage(err?.message || "Booking did not go through. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (seats.length === 0) return <div className="seatpicker"><p className="sp-hint">No seats to show.</p></div>;

  const count = `${selected.length} ${selected.length === 1 ? "seat" : "seats"}`;

  return (
    <div className={`seatpicker ${is3D ? "" : "sp-flat"}`}>
      <div className="sp-screen">Screen</div>

      <div className="sp-map">
        {rows.map((rowSeats) => (
          <div className="sp-row" key={rowSeats[0].row}>
            <span className="sp-rowlabel">{rowSeats[0].row}</span>
            {rowSeats.map((s) => {
              const isTaken = s.status !== "AVAILABLE";
              const isSel = selectedIds.includes(s.id);
              const cls = [
                "sp-seat",
                s.type === "RECLINER" ? "sp-rec" : "",
                isTaken ? "sp-taken" : "",
                isSel ? "sp-sel" : "",
                focusSeat?.id === s.id ? "sp-focus" : "",
              ].join(" ");
              return (
                <Fragment key={s.id}>
                  {s.number === s.aisleAfter + 1 && <span className="sp-aisle" />}
                  <button
                    type="button"
                    className={cls}
                    disabled={isTaken || locked}
                    aria-label={`Row ${s.row}, seat ${s.number}`}
                    aria-pressed={isSel}
                    onClick={() => toggle(s)}
                  />
                </Fragment>
              );
            })}
          </div>
        ))}
      </div>

      <ul className="sp-legend">
        <li><i className="sp-seat" />Available</li>
        <li><i className="sp-seat sp-taken" />Taken</li>
        <li><i className="sp-seat sp-rec" />Recliner</li>
        <li><i className="sp-seat sp-sel" />Selected</li>
      </ul>
      <p className="sp-hint" role="status">
        {message || `Tap up to ${maxSeats} seats. Tap a chosen seat again to remove it.`}
      </p>

      <aside className={`sp-sheet ${selected.length ? "sp-open" : ""}`} aria-live="polite">
        {selected.length > 0 && (
          <>
            {is3D && (
              <View3DBoundary>
                <Suspense fallback={<div className="sp-pov sp-pov-msg">Loading 3D view…</div>}>
                  <SeatView3D seats={seats} selectedIds={selectedIds} focusSeat={focusSeat} />
                </Suspense>
              </View3DBoundary>
            )}

            <div className="sp-chips">
              {selected.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={`sp-chip ${s.id === focusSeat.id ? "sp-on" : ""}`}
                  onClick={() => setFocusId(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <h3>Row {focusSeat.row}, Seat {focusSeat.number}</h3>
            <p className="sp-sub">
              {stats.label} · {focusSeat.type === "RECLINER" ? "Recliner" : "Standard"} · {currency} {focusSeat.price}
            </p>
            <p className="sp-note">{togetherNote(selected)}</p>

            <div className="sp-stats">
              <div><b>{stats.distance} m</b><span>to screen</span></div>
              <div><b>{stats.angle}°</b><span>field of view</span></div>
              <div><b>{currency} {total}</b><span>{count}</span></div>
            </div>

            <div className="sp-actions">
              <button type="button" className="sp-btn sp-ghost" disabled={locked} onClick={() => { setSelectedIds([]); setFocusId(null); }}>
                Clear
              </button>
              <button type="button" className="sp-btn sp-primary" disabled={locked} onClick={confirm}>
                {locked ? "Booking…" : `Book ${count} · ${currency} ${total}`}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}