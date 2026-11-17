import { useEffect, useState } from "react";
import { api } from "../../services/api.js";
import { MOVIE_STATUS } from "../../constants/movieOptions.js";

const initialForm = {
  movieId: "",
  hallId: "",
  date: "",
  startTime: "",
  price: 18,
};

// Fetches everything the page needs. Lives outside the component so the
// mount effect can call it without adding dependencies.
// Pre-select the first movie that can still be scheduled.
const defaultMovieId = (list) =>
  (list.find((m) => m.status !== MOVIE_STATUS.ENDED && m.status !== MOVIE_STATUS.ARCHIVED) || list[0])?._id || "";

const fetchAll = () =>
  Promise.all([api("/movies"), api("/halls"), api("/showtimes")]);

export default function Showtimes() {
  const [movies, setMovies] = useState([]);
  const [halls, setHalls] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isEditing = Boolean(editingId);

  // Ended and archived movies can't get new showtimes. The movie already chosen
  // in the form stays listed so an existing showtime can still be edited.
  const selectableMovies = movies.filter(
    (m) =>
      m._id === form.movieId ||
      (m.status !== MOVIE_STATUS.ENDED && m.status !== MOVIE_STATUS.ARCHIVED)
  );

  // Showtimes must fall inside the movie's availability period.
  const selectedMovie = movies.find((m) => m._id === form.movieId);
  const minDate = selectedMovie?.releaseDate ? String(selectedMovie.releaseDate).slice(0, 10) : undefined;
  const maxDate = selectedMovie?.endDate ? String(selectedMovie.endDate).slice(0, 10) : undefined;

  // Used to refresh the data after save / delete
  async function load() {
    const [m, h, s] = await fetchAll();

    setMovies(m);
    setHalls(h);
    setShowtimes(s);

    setForm((f) => ({
      ...f,
      movieId: f.movieId || defaultMovieId(m),
      hallId: f.hallId || h[0]?._id || "",
    }));
  }

  // Initial load: setState only runs inside the .then callback
  useEffect(() => {
    let cancelled = false;
    fetchAll()
      .then(([m, h, s]) => {
        if (cancelled) return;
        setMovies(m);
        setHalls(h);
        setShowtimes(s);
        setForm((f) => ({
          ...f,
          movieId: f.movieId || defaultMovieId(m),
          hallId: f.hallId || h[0]?._id || "",
        }));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load showtimes.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function editShowtime(s) {
    setEditingId(s._id);
    setError("");

    setForm({
      movieId: s.movie?._id || s.movieId || "",
      hallId: s.hall?._id || s.hallId || "",
      date: String(s.date || "").slice(0, 10),
      startTime: s.startTime || "",
      price: s.price ?? 18,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setError("");

    setForm({
      ...initialForm,
      movieId: defaultMovieId(movies),
      hallId: halls[0]?._id || "",
    });
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        ...form,
        price: Number(form.price),
      };

      if (editingId) {
        await api(`/showtimes/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/showtimes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setEditingId(null);
      setForm({
        ...initialForm,
        movieId: defaultMovieId(movies),
        hallId: halls[0]?._id || "",
      });

      await load();
    } catch (err) {
      setError(err.message || "Failed to save showtime.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this showtime?")) return;

    try {
      setError("");
      await api(`/showtimes/${id}`, { method: "DELETE" });

      if (editingId === id) {
        cancelEdit();
      }

      await load();
    } catch (err) {
      setError(err.message || "Failed to delete showtime.");
    }
  }

  return (
    <section>
      <div className="admin-page-header">
        <div>
          <h1>Showtimes</h1>
          <p className="admin-page-description">
            Manage your cinema showtimes and schedules.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="admin-alert admin-alert-error">
          {error}
        </div>
      )}

      {/* Add / Edit form */}
      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2 className="admin-section-title">
              {isEditing ? "Edit Showtime" : "Add New Showtime"}
            </h2>
            <p className="admin-panel-subtitle">
              {isEditing
                ? "Update the showtime details, then save your changes."
                : "Pick a movie, hall, date, time and ticket price."}
            </p>
          </div>
        </div>

        <div className="admin-panel-body">
          <form onSubmit={submit}>
            <div className="admin-form-grid">
              <div className="admin-field">
                <label className="admin-label" htmlFor="showtime-movie">Movie</label>
                <select
                  id="showtime-movie"
                  name="movieId"
                  className="admin-select"
                  value={form.movieId}
                  onChange={handleChange}
                  required
                >
                  <option value="" disabled>Select movie</option>
                  {selectableMovies.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field">
                <label className="admin-label" htmlFor="showtime-hall">Hall</label>
                <select
                  id="showtime-hall"
                  name="hallId"
                  className="admin-select"
                  value={form.hallId}
                  onChange={handleChange}
                  required
                >
                  <option value="" disabled>Select hall</option>
                  {halls.map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field">
                <label className="admin-label" htmlFor="showtime-date">Date</label>
                <input
                  id="showtime-date"
                  type="date"
                  name="date"
                  className="admin-input"
                  min={minDate}
                  max={maxDate}
                  value={form.date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="admin-field">
                <label className="admin-label" htmlFor="showtime-time">Start time</label>
                <input
                  id="showtime-time"
                  type="time"
                  name="startTime"
                  className="admin-input"
                  value={form.startTime}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="admin-field">
                <label className="admin-label" htmlFor="showtime-price">Price (RM)</label>
                <input
                  id="showtime-price"
                  type="number"
                  name="price"
                  className="admin-input"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

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
                    : "+ Add Showtime"}
              </button>

              {isEditing && (
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Showtime list */}
      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2 className="admin-section-title">All Showtimes</h2>
            <p className="admin-panel-subtitle">
              {loading
                ? "Loading..."
                : `${showtimes.length} ${showtimes.length === 1 ? "showtime" : "showtimes"} scheduled`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <p>Loading showtimes...</p>
          </div>
        ) : showtimes.length === 0 ? (
          <div className="admin-empty-state">
            <div className="admin-empty-icon" aria-hidden="true">◷</div>
            <h3>No showtimes yet</h3>
            <p>Create your first showtime using the form above.</p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Movie</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Hall</th>
                  <th>Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {showtimes.map((s) => (
                  <tr
                    key={s._id}
                    className={s._id === editingId ? "is-editing" : ""}
                  >
                    <td className="admin-cell-primary">
                      {s.movie?.title || "Unknown movie"}
                    </td>
                    <td>{String(s.date).slice(0, 10)}</td>
                    <td>{s.startTime}</td>
                    <td>{s.hall?.name || "Unknown hall"}</td>
                    <td>
                      <strong>RM {Number(s.price).toFixed(2)}</strong>
                    </td>
                    <td>
                      <div className="admin-table-actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          onClick={() => editShowtime(s)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-danger admin-btn-sm"
                          onClick={() => remove(s._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}