import { useEffect, useState } from "react";
import { api } from "../../services/api.js";
import { MOVIE_STATUS } from "../../constants/movieOptions.js";
import PopupHost, { useConfirm } from "../../components/Popup.jsx";
import ActionButton from "../../components/ActionButton.jsx";
import { getShowtimeStatus } from "../../constants/showtimeStatus.js";

const initialForm = {
  movieId: "",
  hallId: "",
  date: "",
  startTime: "",
  price: 18,
};

const HALL_STATUS = {
  ACTIVE: "ACTIVE",
  MAINTENANCE: "MAINTENANCE",
  INACTIVE: "INACTIVE",
};

function formatDuration(minutes) {
  const value = Number(minutes);

  if (!Number.isFinite(value) || value < 0) {
    return "—";
  }

  const hours = Math.floor(value / 60);
  const remainingMinutes = value % 60;

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}

function timeToMinutes(time) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }

  const [hours, minutes] = time.split(":").map(Number);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  if (!Number.isFinite(totalMinutes)) {
    return "";
  }

  const normalized = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;

  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
}

function formatTime(time) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    return "—";
  }

  const [hours, minutes] = time.split(":").map(Number);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return "—";
  }

  const date = new Date();

  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function hallStatusLabel(status) {
  switch (status) {
    case HALL_STATUS.MAINTENANCE:
      return "Maintenance";

    case HALL_STATUS.INACTIVE:
      return "Inactive";

    default:
      return "Active";
  }
}

export default function Showtimes() {
  const [movies, setMovies] = useState([]);
  const [halls, setHalls] = useState([]);
  const [showtimes, setShowtimes] = useState([]);

  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // "Now", refreshed every minute so statuses update while the page is open
  const [now, setNow] = useState(() => Date.now());

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [askConfirm, confirmDialog] = useConfirm();

  const isEditing = editingId !== null;

  function defaultMovieId(movieList) {
    const availableMovies = movieList.filter(
      (movie) =>
        movie.status !== MOVIE_STATUS.ENDED &&
        movie.status !== MOVIE_STATUS.ARCHIVED
    );

    return availableMovies[0]?._id || movieList[0]?._id || "";
  }

  function defaultHallId(hallList) {
    const activeHall = hallList.find(
      (hall) =>
        String(hall.status || HALL_STATUS.ACTIVE).toUpperCase() ===
        HALL_STATUS.ACTIVE
    );

    return activeHall?._id || hallList[0]?._id || "";
  }

  async function fetchAll() {
    const [movieData, hallData, showtimeData] = await Promise.all([
      api("/movies"),
      api("/halls"),
      api("/showtimes"),
    ]);

    setMovies(movieData);
    setHalls(hallData);
    setShowtimes(showtimeData);

    setForm((current) => ({
      ...current,
      movieId: current.movieId || defaultMovieId(movieData),
      hallId: current.hallId || defaultHallId(hallData),
    }));
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const [movieData, hallData, showtimeData] = await Promise.all([
          api("/movies"),
          api("/halls"),
          api("/showtimes"),
        ]);

        if (cancelled) {
          return;
        }

        setMovies(movieData);
        setHalls(hallData);
        setShowtimes(showtimeData);

        setForm((current) => ({
          ...current,
          movieId: current.movieId || defaultMovieId(movieData),
          hallId: current.hallId || defaultHallId(hallData),
        }));
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load showtimes.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  function setField(field) {
    return (event) => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value,
      }));

      setMessage("");
      setError("");
    };
  }

  function resetForm() {
    setForm({
      ...initialForm,
      movieId: defaultMovieId(movies),
      hallId: defaultHallId(halls),
    });

    setEditingId(null);
    setMessage("");
    setError("");
  }

  function startEdit(showtime) {
    setMessage("");
    setError("");

    setEditingId(showtime._id);

    setForm({
      movieId: showtime.movieId || showtime.movie?._id || "",
      hallId: showtime.hallId || showtime.hall?._id || "",
      date: String(showtime.date || "").slice(0, 10),
      startTime: showtime.startTime,
      price: showtime.price,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function remove(showtime) {
    const movieTitle =
      showtime.movie?.title ||
      showtime.movieTitle ||
      "this showtime";

    const confirmed = await askConfirm({
      title: "Delete this showtime?",
      message: `"${movieTitle}" on ${String(showtime.date || "").slice(0, 10)} at ${formatTime(
        showtime.startTime
      )} will be permanently deleted. This cannot be undone.`,
      confirmText: "Delete",
      tone: "danger",
      icon: "trash",
    });

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await api(`/showtimes/${showtime._id}`, {
        method: "DELETE",
      });

      if (editingId === showtime._id) {
        resetForm();
      }

      setMessage("Showtime has been deleted.");
      await fetchAll();
    } catch (err) {
      setError(err.message || "Unable to delete the showtime.");
    }
  }

  async function submit(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!form.movieId) {
      setError("Please select a movie.");
      return;
    }

    if (!form.hallId) {
      setError("Please select a hall.");
      return;
    }

    if (!form.date) {
      setError("Please select a date.");
      return;
    }

    if (!form.startTime) {
      setError("Please select a start time.");
      return;
    }

    const price = Number(form.price);

    if (!Number.isFinite(price) || price < 0) {
      setError("Ticket price must be a valid amount of RM 0 or more.");
      return;
    }

    const selectedHall = halls.find(
      (hall) => hall._id === form.hallId
    );

    const hallStatus = String(
      selectedHall?.status || HALL_STATUS.ACTIVE
    ).toUpperCase();

    if (
      !isEditing &&
      hallStatus !== HALL_STATUS.ACTIVE
    ) {
      setError(
        hallStatus === HALL_STATUS.MAINTENANCE
          ? `"${selectedHall?.name || "This hall"}" is under maintenance and cannot receive new showtimes.`
          : `"${selectedHall?.name || "This hall"}" is inactive and cannot receive new showtimes.`
      );

      return;
    }

    setSaving(true);

    try {
      const payload = {
        movieId: form.movieId,
        hallId: form.hallId,
        date: form.date,
        startTime: form.startTime,
        price,
      };

      if (isEditing) {
        await api(`/showtimes/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        setMessage("Showtime has been updated.");
      } else {
        await api("/showtimes", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setMessage("Showtime has been added.");
      }

      resetForm();
      await fetchAll();
    } catch (err) {
      setError(err.message || "Unable to save the showtime.");
    } finally {
      setSaving(false);
    }
  }

  const selectedMovie = movies.find(
    (movie) => movie._id === form.movieId
  );

  const selectedHall = halls.find(
    (hall) => hall._id === form.hallId
  );

  const movieDuration = Number(selectedMovie?.duration);

  const cleaningMinutes = Number(
    selectedHall?.cleaningMinutes ?? 20
  );

  const startMinutes = timeToMinutes(form.startTime);

  const calculatedEndTime =
    startMinutes !== null &&
    Number.isFinite(movieDuration) &&
    movieDuration >= 0
      ? minutesToTime(startMinutes + movieDuration)
      : "";

  const hallAvailableTime =
    calculatedEndTime &&
    Number.isFinite(cleaningMinutes) &&
    cleaningMinutes >= 0
      ? minutesToTime(
          timeToMinutes(calculatedEndTime) + cleaningMinutes
        )
      : "";

  const crossesMidnight =
    startMinutes !== null &&
    calculatedEndTime &&
    timeToMinutes(calculatedEndTime) <= startMinutes;

  const selectableMovies = movies.filter(
    (movie) =>
      movie._id === form.movieId ||
      (movie.status !== MOVIE_STATUS.ENDED &&
        movie.status !== MOVIE_STATUS.ARCHIVED)
  );

  const selectableHalls = halls.filter((hall) => {
    const status = String(
      hall.status || HALL_STATUS.ACTIVE
    ).toUpperCase();

    return (
      hall._id === form.hallId ||
      status === HALL_STATUS.ACTIVE
    );
  });

  const totalBookings = showtimes.reduce(
    (sum, item) => sum + (Number(item.bookingCount) || 0),
    0
  );

  return (
    <section>
      <div className="admin-page-header">
        <div>
          <h1>Showtimes</h1>

          <p className="admin-page-description">
            Schedule movies in your cinema halls and manage ticket prices.
          </p>
        </div>
      </div>

      {/* Centered pop-up messages */}
      <PopupHost
        error={error}
        notice={message}
        onCloseError={() => setError("")}
        onCloseNotice={() => setMessage("")}
      />
      {confirmDialog}

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2 className="admin-section-title">
              {isEditing
                ? "Edit Showtime"
                : "Add New Showtime"}
            </h2>

            <p className="admin-panel-subtitle">
              Pick a movie, hall, date, start time and ticket
              price. The end time is calculated automatically.
            </p>
          </div>
        </div>

        <div className="admin-panel-body">
          <form onSubmit={submit}>
            {/* =====================================================
                SCHEDULE DETAILS
                ===================================================== */}
            <div className="showtime-form-section">
              <div className="showtime-section-heading">
                <div>
                  <h3>Schedule details</h3>

                  <p>
                    Select the movie, hall, date, start time
                    and ticket price.
                  </p>
                </div>
              </div>

              <div className="showtime-main-grid">
                {/* Movie */}
                <div className="admin-field">
                  <label className="admin-label" htmlFor="showtime-movie">
                    Movie
                  </label>

                  <select
                    id="showtime-movie"
                    className="admin-input"
                    value={form.movieId}
                    onChange={setField("movieId")}
                    required
                  >
                    <option value="" disabled>
                      Select a movie
                    </option>

                    {selectableMovies.map((movie) => (
                      <option key={movie._id} value={movie._id}>
                        {movie.title}
                        {movie.status === MOVIE_STATUS.ENDED
                          ? " — Ended"
                          : movie.status === MOVIE_STATUS.ARCHIVED
                            ? " — Archived"
                            : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Hall */}
                <div className="admin-field">
                  <label className="admin-label" htmlFor="showtime-hall">
                    Hall
                  </label>

                  <select
                    id="showtime-hall"
                    className="admin-input"
                    value={form.hallId}
                    onChange={setField("hallId")}
                    required
                  >
                    <option value="" disabled>
                      Select a hall
                    </option>

                    {selectableHalls.map((hall) => {
                      const status = String(
                        hall.status || HALL_STATUS.ACTIVE
                      ).toUpperCase();

                      const unavailable =
                        status !== HALL_STATUS.ACTIVE &&
                        hall._id !== form.hallId;

                      return (
                        <option
                          key={hall._id}
                          value={hall._id}
                          disabled={unavailable}
                        >
                          {hall.name}
                          {status !== HALL_STATUS.ACTIVE
                            ? ` — ${hallStatusLabel(status)}`
                            : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Date */}
                <div className="admin-field">
                  <label className="admin-label" htmlFor="showtime-date">
                    Date
                  </label>

                  <input
                    id="showtime-date"
                    type="date"
                    className="admin-input"
                    value={form.date}
                    min={selectedMovie?.releaseDate || undefined}
                    max={selectedMovie?.endDate || undefined}
                    onChange={setField("date")}
                    required
                  />
                </div>

                {/* Start time */}
                <div className="admin-field">
                  <label
                    className="admin-label"
                    htmlFor="showtime-start-time"
                  >
                    Start time
                  </label>

                  <input
                    id="showtime-start-time"
                    type="time"
                    className="admin-input"
                    value={form.startTime}
                    onChange={setField("startTime")}
                    required
                  />
                </div>

                {/* Price */}
                <div className="admin-field">
                  <label
                    className="admin-label"
                    htmlFor="showtime-price"
                  >
                    Price (RM)
                  </label>

                  <input
                    id="showtime-price"
                    type="number"
                    className="admin-input"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={setField("price")}
                    required
                  />
                </div>
              </div>
            </div>

            {/* =====================================================
                AUTOMATIC SCHEDULE
                ===================================================== */}
            <div className="showtime-auto-section">
              <div className="showtime-section-heading">
                <div>
                  <h3>Automatic schedule</h3>
                </div>

                <span className="showtime-auto-indicator">
                  AUTO-CALCULATED
                </span>
              </div>

              <div className="showtime-auto-grid">
                {/* Movie duration */}
                <div className="showtime-auto-card">
                  <div className="showtime-auto-card-top">
                    <span className="showtime-auto-label">
                      Duration
                    </span>

                    <span className="showtime-auto-badge">
                      AUTO
                    </span>
                  </div>

                  <div className="showtime-auto-value">
                    {Number.isFinite(movieDuration) && movieDuration >= 0
                      ? formatDuration(movieDuration)
                      : "—"}
                  </div>

                  <div className="showtime-auto-description">
                    From movie settings
                  </div>
                </div>

                {/* End time */}
                <div className="showtime-auto-card">
                  <div className="showtime-auto-card-top">
                    <span className="showtime-auto-label">
                      End time
                    </span>

                    <span className="showtime-auto-badge">
                      AUTO
                    </span>
                  </div>

                  <div className="showtime-auto-value">
                    {calculatedEndTime
                      ? formatTime(calculatedEndTime)
                      : "—"}
                  </div>

                  <div className="showtime-auto-description">
                    Start Time + duration
                  </div>

                  {crossesMidnight && (
                    <div className="showtime-auto-note">
                      Ends next day
                    </div>
                  )}
                </div>

                {/* Hall cleaning */}
                <div className="showtime-auto-card">
                  <div className="showtime-auto-card-top">
                    <span className="showtime-auto-label">
                      Cleaning
                    </span>

                    <span className="showtime-auto-badge">
                      AUTO
                    </span>
                  </div>

                  <div className="showtime-auto-value">
                    {selectedHall
                      ? `${cleaningMinutes} min`
                      : "—"}
                  </div>

                  <div className="showtime-auto-description">
                    From hall settings
                  </div>
                </div>

                {/* Hall available again */}
                <div className="showtime-auto-card">
                  <div className="showtime-auto-card-top">
                    <span className="showtime-auto-label">
                      Available again
                    </span>

                    <span className="showtime-auto-badge">
                      AUTO
                    </span>
                  </div>

                  <div className="showtime-auto-value">
                    {hallAvailableTime
                      ? formatTime(hallAvailableTime)
                      : "—"}
                  </div>

                  <div className="showtime-auto-description">
                    End Time + cleaning
                  </div>
                </div>
              </div>
            </div>

            {/* =====================================================
                SUMMARY
                ===================================================== */}
            {selectedMovie &&
              selectedHall &&
              form.startTime &&
              calculatedEndTime &&
              hallAvailableTime && (
                <div className="showtime-summary">
                  <span className="showtime-summary-label">
                    Schedule summary
                  </span>

                  <span className="showtime-summary-text">
                    {selectedMovie.title} runs for{" "}
                    {formatDuration(movieDuration)}, from{" "}
                    {formatTime(form.startTime)} to{" "}
                    {formatTime(calculatedEndTime)}.{" "}
                    {selectedHall.name} then requires{" "}
                    {cleaningMinutes} minutes of cleaning
                    and will be available again at{" "}
                    {formatTime(hallAvailableTime)}.
                  </span>
                </div>
              )}

            {/* =====================================================
                FORM ACTIONS
                ===================================================== */}
            <div className="admin-form-actions showtime-form-actions">
              <button
                type="submit"
                className="admin-btn admin-btn-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : isEditing
                    ? "Save Changes"
                    : "+ Add Showtime"}
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

      {/* =========================================================
          ALL SHOWTIMES
          ========================================================= */}
      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2 className="admin-section-title">
              All Showtimes
            </h2>

            <p className="admin-panel-subtitle">
              {showtimes.length}{" "}
              {showtimes.length === 1
                ? "showtime"
                : "showtimes"}{" "}
              configured
            </p>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <p>Loading showtimes...</p>
          </div>
        ) : showtimes.length === 0 ? (
          <div className="admin-empty-state">
            <div
              className="admin-empty-icon"
              aria-hidden="true"
            >
              ▷
            </div>

            <h3>No showtimes yet</h3>

            <p>
              Add your first showtime using the form above.
            </p>
          </div>
        ) : (
          <>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Movie</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Hall</th>
                    <th>Price</th>
                    <th>Bookings</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {showtimes.map((showtime) => {
                    const movie =
                      showtime.movie ||
                      movies.find(
                        (item) =>
                          item._id === showtime.movieId
                      );

                    const hall =
                      showtime.hall ||
                      halls.find(
                        (item) =>
                          item._id === showtime.hallId
                      );

                    const duration = Number(
                      movie?.duration
                    );

                    const endTime =
                      timeToMinutes(
                        showtime.startTime
                      ) !== null &&
                      Number.isFinite(duration) &&
                      duration >= 0
                        ? minutesToTime(
                            timeToMinutes(
                              showtime.startTime
                            ) + duration
                          )
                        : "";

                    const statusKey = getShowtimeStatus(
                      showtime,
                      duration,
                      now
                    );

                    // bookingCount comes from the server (same idea as movies).
                    // A showtime with bookings can't be deleted.
                    const bookingCount = Number(showtime.bookingCount);
                    const hasCount = Number.isFinite(bookingCount);
                    const locked = hasCount && bookingCount > 0;
                    const deleteReason = locked
                      ? `This showtime has ${bookingCount} booking${
                          bookingCount === 1 ? "" : "s"
                        }, so it can't be deleted.`
                      : "Delete showtime";

                    return (
                      <tr
                        key={showtime._id}
                        className={[
                          showtime._id === editingId ? "is-editing" : "",
                          statusKey === "ENDED" ? "is-passed" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <td className="admin-cell-primary">
                          {movie?.title ||
                            showtime.movieTitle ||
                            "Unknown movie"}
                        </td>

                        <td>
                          {String(showtime.date || "").slice(0, 10)}
                        </td>

                        <td>
                          <div>
                            {formatTime(
                              showtime.startTime
                            )}

                            {endTime && (
                              <div className="showtime-table-end">
                                – {formatTime(endTime)}
                              </div>
                            )}
                          </div>
                        </td>

                        <td>
                          {hall?.name ||
                            showtime.hallName ||
                            "Unknown hall"}
                        </td>

                        <td>
                          RM{" "}
                          {Number(
                            showtime.price
                          ).toFixed(2)}
                        </td>

                        <td>
                          {!hasCount ? (
                            <span title="Booking count not available">—</span>
                          ) : bookingCount > 0 ? (
                            <span
                              className="admin-status admin-status-success"
                              title="Bookings can't be deleted with the showtime."
                            >
                              {bookingCount}{" "}
                              {bookingCount === 1 ? "booking" : "bookings"}
                            </span>
                          ) : (
                            <span>No bookings</span>
                          )}
                        </td>

                        <td>
                          <div className="app-act-group">
                            <ActionButton
                              variant="edit"
                              onClick={() => startEdit(showtime)}
                            >
                              Edit
                            </ActionButton>

                            <ActionButton
                              variant="delete"
                              icon={locked ? "lock" : "trash"}
                              onClick={() => remove(showtime)}
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
                Total showtimes: {showtimes.length} · {totalBookings}{" "}
                {totalBookings === 1 ? "booking" : "bookings"}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}