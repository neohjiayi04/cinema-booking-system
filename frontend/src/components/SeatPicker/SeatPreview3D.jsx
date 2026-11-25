import { Component, lazy, Suspense, useMemo, useState } from "react";
import { normalizeSeats, togetherNote, viewStats } from "./seatMath.js";
import "./SeatPicker.css"; // SeatView3D's .sp-pov / .sp-tag / .sp-drag styles
import "./SeatPreview3D.css";

// lazy: three.js only downloads the first time a seat is picked with the preview switched on
const SeatView3D = lazy(() => import("./SeatView3D.jsx"));

// No WebGL on this device? Show a message instead of crashing the page.
class PreviewBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.error("3D seat preview failed:", err);
  }
  render() {
    if (this.state.failed) {
      return <div className="sp3d-empty">The 3D preview isn&apos;t available on this device.</div>;
    }
    return this.props.children;
  }
}

/** On/off switch shown above the seat map. */
export function PreviewSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`sp3d-switch ${checked ? "is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="sp3d-switch-track"><i /></span>
      <span>3D seat preview</span>
    </button>
  );
}

/**
 * First-person view from a seat the customer picked on the normal seat map.
 *   seats     the raw seat list (same shape SeatPicker takes; see seatMath.defaultAdapt)
 *   selected  ids of the seats picked so far, e.g. ["F06", "F07"]
 *   hoverId   optional id of the seat the pointer is over; it is previewed until the pointer leaves
 */
export default function SeatPreview3D({ seats: rawSeats, selected, hoverId = null, currency = "RM" }) {
  const seats = useMemo(() => normalizeSeats(rawSeats), [rawSeats]);
  const byId = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);

  const picked = selected.map((id) => byId.get(id)).filter(Boolean);
  const pickedIds = picked.map((s) => s.id);

  // A chip the customer tapped only counts while the selection is unchanged; a newly picked seat takes over.
  const [chip, setChip] = useState({ id: null, count: 0 });
  const chosen = chip.count === pickedIds.length && pickedIds.includes(chip.id) ? byId.get(chip.id) : null;
  const hovered = hoverId ? byId.get(hoverId) || null : null;
  const focusSeat = hovered || chosen || picked[picked.length - 1] || null;
  const hoverOnly = Boolean(hovered) && !pickedIds.includes(hovered.id);
  const stats = focusSeat ? viewStats(focusSeat) : null;

  return (
    <section className="sp3d" aria-label="3D view from your seat">
      <div className="sp3d-head">
        <span className="sp3d-title">View from your seat</span>
        {hoverOnly
          ? <span className="sp3d-note">Hover preview</span>
          : picked.length > 1 && <span className="sp3d-note">{togetherNote(picked)}</span>}
      </div>

      {focusSeat ? (
        <>
          <div className="sp3d-view">
            <PreviewBoundary>
              <Suspense fallback={<div className="sp3d-empty">Loading 3D view…</div>}>
                <SeatView3D seats={seats} selectedIds={pickedIds} focusSeat={focusSeat} />
              </Suspense>
            </PreviewBoundary>
          </div>

          {picked.length > 1 && (
            <div className="sp3d-chips">
              {picked.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={`sp3d-chip ${s.id === focusSeat.id ? "is-on" : ""}`}
                  onClick={() => setChip({ id: s.id, count: pickedIds.length })}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div>
            <strong className="sp3d-seat">Row {focusSeat.row}, Seat {focusSeat.number}</strong>
            <span className="sp3d-sub">
              {stats.label} · {focusSeat.type === "RECLINER" ? "Recliner" : "Standard"} · {currency} {focusSeat.price}
            </span>
          </div>

          <div className="sp3d-stats">
            <div><b>{stats.distance} m</b><span>to screen</span></div>
            <div><b>{stats.angle}°</b><span>field of view</span></div>
            <div><b>{picked.length}</b><span>{picked.length === 1 ? "seat" : "seats"}</span></div>
          </div>
        </>
      ) : (
        <div className="sp3d-empty">Hover or pick a seat on the map to see the view from it.</div>
      )}
    </section>
  );
}