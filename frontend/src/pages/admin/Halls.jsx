import { useEffect, useRef, useState } from "react";
import { api } from "../../services/api.js";
import PopupHost, { useConfirm } from "../../components/Popup.jsx";
import ActionButton from "../../components/ActionButton.jsx";
import { getShowtimeStatus } from "../../constants/showtimeStatus.js";

const EMPTY_FORM = {
  name: "",
  rows: 5,
  seatsPerRow: 8,
  cleaningMinutes: 20,
  status: "ACTIVE",
};

const HALL_STATUSES = ["ACTIVE", "MAINTENANCE", "INACTIVE"];

// Halls are required. Showtimes + movies only feed the "current showtimes"
// column, so if they fail to load the page still works (count shows None).
function fetchAll() {
  return Promise.all([
    api("/halls"),
    api("/showtimes").catch(() => []),
    api("/movies").catch(() => []),
  ]);
}

export default function Halls() {
  const [halls, setHalls] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [movies, setMovies] = useState([]);

  // "Now", refreshed every minute so finished showtimes drop out of the count
  const [now, setNow] = useState(() => Date.now());
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [askConfirm, confirmDialog] = useConfirm();

  const formRef = useRef(null);
  const nameRef = useRef(null);
  const isEditing = editingId !== null;

  /* READ */
  async function load() {
    try {
      const [hallData, showtimeData, movieData] = await fetchAll();
      setHalls(hallData);
      setShowtimes(showtimeData);
      setMovies(movieData);
    } catch (err) {
      setError(err.message || "Unable to load halls.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    fetchAll()
      .then(([hallData, showtimeData, movieData]) => {
        if (cancelled) return;
        setHalls(hallData);
        setShowtimes(showtimeData);
        setMovies(movieData);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Unable to load halls.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  function setField(field) {
    return (event) =>
      setForm((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
  }

  /* CREATE + UPDATE */
  async function submit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const payload = {
      name: form.name.trim(),
      rows: Number(form.rows),
      seatsPerRow: Number(form.seatsPerRow),
      cleaningMinutes: Number(form.cleaningMinutes),
      status: String(form.status || "ACTIVE").toUpperCase(),
    };

    if (!payload.name) {
      setError("Please enter a hall name.");
      return;
    }

    if (
      !Number.isInteger(payload.rows) ||
      !Number.isInteger(payload.seatsPerRow) ||
      payload.rows < 1 ||
      payload.seatsPerRow < 1
    ) {
      setError("Rows and seats per row must be whole numbers of at least 1.");
      return;
    }

    if (
      !Number.isInteger(payload.cleaningMinutes) ||
      payload.cleaningMinutes < 0
    ) {
      setError("Cleaning time must be a whole number of 0 minutes or more.");
      return;
    }

    if (!HALL_STATUSES.includes(payload.status)) {
      setError("Please select a valid hall status.");
      return;
    }

    setSaving(true);

    try {
      if (isEditing) {
        await api(`/halls/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        setMessage(`"${payload.name}" has been updated.`);
      } else {
        await api("/halls", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setMessage(`"${payload.name}" has been added.`);
      }

      resetForm();
      await load();
    } catch (err) {
      setError(err.message || "Unable to save the hall.");
    } finally {
      setSaving(false);
    }
  }

  /* Load a hall into the form for editing */
  function startEdit(hall) {
    setMessage("");
    setError("");
    setEditingId(hall._id);

    setForm({
      name: hall.name,
      rows: hall.rows,
      seatsPerRow: hall.seatsPerRow,
      cleaningMinutes: hall.cleaningMinutes ?? 20,
      status: hall.status ?? "ACTIVE",
    });

    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      nameRef.current?.focus();
    });
  }

  /* DELETE */
  async function remove(hall) {
    const ok = await askConfirm({
      title: "Delete this hall?",
      message: `"${hall.name}" will be permanently deleted. This cannot be undone.`,
      confirmText: "Delete",
      tone: "danger",
      icon: "trash",
    });

    if (!ok) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await api(`/halls/${hall._id}`, {
        method: "DELETE",
      });

      if (editingId === hall._id) {
        resetForm();
      }

      setMessage(`"${hall.name}" has been deleted.`);
      await load();
    } catch (err) {
      setError(err.message || "Unable to delete the hall.");
    }
  }

  const totalSeats = halls.reduce(
    (sum, hall) => sum + hall.rows * hall.seatsPerRow,
    0
  );

  // hallId -> { upcoming, nowShowing, ended }.
  // "Current" = upcoming + now showing (shown in the column).
  // Ended showtimes are tracked separately because they still block deletion.
  const movieById = new Map(movies.map((m) => [String(m._id), m]));
  const showtimeStats = {};

  for (const showtime of showtimes) {
    const hallId = String(showtime.hallId || showtime.hall?._id || "");
    if (!hallId) continue;

    const movie =
      showtime.movie || movieById.get(String(showtime.movieId || ""));

    const status = getShowtimeStatus(showtime, Number(movie?.duration), now);

    if (!showtimeStats[hallId]) {
      showtimeStats[hallId] = { upcoming: 0, nowShowing: 0, ended: 0 };
    }

    if (status === "NOW_SHOWING") showtimeStats[hallId].nowShowing += 1;
    else if (status === "UPCOMING") showtimeStats[hallId].upcoming += 1;
    else showtimeStats[hallId].ended += 1;
  }

  function currentShowtimeCount(hall) {
    const stats = showtimeStats[String(hall._id)];
    return stats ? stats.upcoming + stats.nowShowing : 0;
  }

  function totalShowtimeCount(hall) {
    const stats = showtimeStats[String(hall._id)];
    return stats ? stats.upcoming + stats.nowShowing + stats.ended : 0;
  }

  const totalCurrentShowtimes = halls.reduce(
    (sum, hall) => sum + currentShowtimeCount(hall),
    0
  );

  const previewSeats =
    (Number(form.rows) || 0) * (Number(form.seatsPerRow) || 0);

  function statusLabel(status) {
    switch (status) {
      case "MAINTENANCE":
        return "Maintenance";
      case "INACTIVE":
        return "Inactive";
      default:
        return "Active";
    }
  }

  function statusClass(status) {
    switch (status) {
      case "MAINTENANCE":
        return "admin-status-warning";
      case "INACTIVE":
        return "admin-status-danger";
      default:
        return "admin-status-success";
    }
  }

  return (
    <section>
      {/* Centered pop-up messages */}
      <PopupHost
        error={error}
        notice={message}
        onCloseError={() => setError("")}
        onCloseNotice={() => setMessage("")}
      />
      {confirmDialog}

      <div className="admin-page-header">
        <div>
          <h1>Halls</h1>
          <p className="admin-page-description">
            Manage cinema halls, seating capacity, cleaning time, and
            availability status.
          </p>
        </div>
      </div>

      {/* Add / Edit form */}
      <div className="admin-panel" ref={formRef}>
        <div className="admin-panel-header">
          <div>
            <h2 className="admin-section-title">
              {isEditing ? "Edit Hall" : "Add New Hall"}
            </h2>

            <p className="admin-panel-subtitle">
              {isEditing
                ? "Update the hall details, availability, and seating layout."
                : "Set the hall name, seating layout, cleaning time, and availability."}
            </p>
          </div>

          {previewSeats > 0 && (
            <span className="admin-status admin-status-info">
              {previewSeats} seats
            </span>
          )}
        </div>

        <div className="admin-panel-body">
          <form className="admin-hall-form" onSubmit={submit}>
            <div className="admin-form-grid admin-form-grid-3">
              <div className="admin-field">
                <label className="admin-label" htmlFor="hall-name">
                  Hall name
                </label>

                <input
                  id="hall-name"
                  ref={nameRef}
                  className="admin-input"
                  placeholder="e.g. Hall 1"
                  value={form.name}
                  onChange={setField("name")}
                  maxLength={60}
                  required
                />
              </div>

              <div className="admin-field">
                <label className="admin-label" htmlFor="hall-rows">
                  Rows
                </label>

                <input
                  id="hall-rows"
                  className="admin-input"
                  type="number"
                  min="1"
                  max="50"
                  placeholder="Rows"
                  value={form.rows}
                  onChange={setField("rows")}
                  required
                />
              </div>

              <div className="admin-field">
                <label className="admin-label" htmlFor="hall-seats">
                  Seats per row
                </label>

                <input
                  id="hall-seats"
                  className="admin-input"
                  type="number"
                  min="1"
                  max="50"
                  placeholder="Seats per row"
                  value={form.seatsPerRow}
                  onChange={setField("seatsPerRow")}
                  required
                />
              </div>

              <div className="admin-field">
                <label
                  className="admin-label"
                  htmlFor="hall-cleaning-minutes"
                >
                  Cleaning time (minutes)
                </label>

                <div className="admin-input-with-suffix">
                  <input
                    id="hall-cleaning-minutes"
                    className="admin-input"
                    type="number"
                    min="0"
                    max="180"
                    placeholder="20"
                    value={form.cleaningMinutes}
                    onChange={setField("cleaningMinutes")}
                    required
                  />
                </div>
              </div>

              <div className="admin-field">
                <label className="admin-label" htmlFor="hall-status">
                  Status
                </label>

                <select
                  id="hall-status"
                  className="admin-input"
                  value={form.status}
                  onChange={setField("status")}
                  required
                >
                  <option value="ACTIVE">Active</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            {form.status === "MAINTENANCE" && (
              <div className="admin-alert admin-alert-warning">
                <strong>Maintenance mode:</strong> this hall cannot receive
                new showtimes or bookings while it is under maintenance.
              </div>
            )}

            {form.status === "INACTIVE" && (
              <div className="admin-alert admin-alert-warning">
                <strong>Inactive hall:</strong> this hall cannot receive new
                showtimes or bookings while it is inactive.
              </div>
            )}

            <div className="admin-form-actions">
              <button
                type="submit"
                className="admin-btn admin-btn-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : isEditing
                    ? "Save Changes"
                    : "+ Add Hall"}
              </button>

              {isEditing && (
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Hall list */}
      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2 className="admin-section-title">All Halls</h2>

            <p className="admin-panel-subtitle">
              {halls.length} {halls.length === 1 ? "hall" : "halls"} configured
            </p>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <p>Loading halls...</p>
          </div>
        ) : halls.length === 0 ? (
          <div className="admin-empty-state">
            <div className="admin-empty-icon" aria-hidden="true">
              ▤
            </div>

            <h3>No halls yet</h3>
            <p>Add your first hall using the form above.</p>
          </div>
        ) : (
          <>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Hall</th>
                    <th>Rows</th>
                    <th>Seats / row</th>
                    <th>Total seats</th>
                    <th>Cleaning</th>
                    <th>Status</th>
                    <th>Current showtimes</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {halls.map((hall) => {
                    const status = hall.status ?? "ACTIVE";
                    const stats = showtimeStats[String(hall._id)];
                    const currentCount = currentShowtimeCount(hall);

                    // A hall with ANY showtime (including ended) can't be deleted.
                    const totalCount = totalShowtimeCount(hall);
                    const endedCount = stats?.ended ?? 0;
                    const locked = totalCount > 0;
                    const deleteReason = locked
                      ? `This hall has ${totalCount} showtime${
                          totalCount === 1 ? "" : "s"
                        }${
                          endedCount > 0
                            ? ` (${endedCount} already ended)`
                            : ""
                        }, so it can't be deleted. Remove them first, or set the hall to Inactive.`
                      : "Delete hall";

                    return (
                      <tr
                        key={hall._id}
                        className={
                          hall._id === editingId ? "is-editing" : ""
                        }
                      >
                        <td className="admin-cell-primary">
                          {hall.name}
                        </td>

                        <td>{hall.rows}</td>

                        <td>{hall.seatsPerRow}</td>

                        <td>
                          <strong>
                            {hall.rows * hall.seatsPerRow}
                          </strong>
                        </td>

                        <td>
                          {hall.cleaningMinutes ?? 20} min
                        </td>

                        <td>
                          <span
                            className={`admin-status ${statusClass(status)}`}
                          >
                            {statusLabel(status)}
                          </span>
                        </td>

                        <td>
                          {currentCount > 0 ? (
                            <>
                              <span
                                className="admin-status admin-status-info"
                                title={`${stats.upcoming} upcoming · ${stats.nowShowing} now showing`}
                              >
                                {currentCount}{" "}
                                {currentCount === 1 ? "showtime" : "showtimes"}
                              </span>

                              {stats.nowShowing > 0 && (
                                <div className="showtime-table-end">
                                  {stats.nowShowing} playing now
                                </div>
                              )}
                            </>
                          ) : (
                            <span>None</span>
                          )}

                          {endedCount > 0 && (
                            <div className="showtime-table-end">
                              {endedCount} ended
                            </div>
                          )}
                        </td>

                        <td>
                          <div className="app-act-group">
                            <ActionButton
                              variant="edit"
                              onClick={() => startEdit(hall)}
                            >
                              Edit
                            </ActionButton>

                            <ActionButton
                              variant="delete"
                              icon={locked ? "lock" : "trash"}
                              onClick={() => remove(hall)}
                              disabled={locked}
                              title={deleteReason}
                            >
                              Delete
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="admin-table-footer">
              <span>
                Total capacity: {totalSeats} seats across {halls.length}{" "}
                {halls.length === 1 ? "hall" : "halls"} · {totalCurrentShowtimes}{" "}
                current {totalCurrentShowtimes === 1 ? "showtime" : "showtimes"}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}