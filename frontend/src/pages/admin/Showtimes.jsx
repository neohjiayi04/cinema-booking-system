
import { useEffect, useState } from "react";
import { api } from "../../services/api.js";

const initialForm = {
  movieId: "",
  hallId: "",
  date: "",
  startTime: "",
  price: 18,
};

export default function Showtimes() {
  const [movies, setMovies] = useState([]);
  const [halls, setHalls] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [m, h, s] = await Promise.all([
      api("/movies"),
      api("/halls"),
      api("/showtimes"),
    ]);

    setMovies(m);
    setHalls(h);
    setShowtimes(s);

    setForm((f) => ({
      ...f,
      movieId: f.movieId || m[0]?._id || "",
      hallId: f.hallId || h[0]?._id || "",
    }));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message || "Failed to load showtimes."));
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
      movieId: movies[0]?._id || "",
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
        movieId: movies[0]?._id || "",
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
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}

      <form className="admin-form" onSubmit={submit}>
        <select
          name="movieId"
          value={form.movieId}
          onChange={handleChange}
          required
        >
          <option value="" disabled>Select movie</option>
          {movies.map((m) => (
            <option key={m._id} value={m._id}>
              {m.title}
            </option>
          ))}
        </select>

        <select
          name="hallId"
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

        <input
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
          required
        />

        <input
          type="time"
          name="startTime"
          value={form.startTime}
          onChange={handleChange}
          required
        />

        <input
          type="number"
          name="price"
          min="0"
          step="0.01"
          value={form.price}
          onChange={handleChange}
          required
        />

        <div className="showtime-form-actions">
          <button className="button" type="submit" disabled={saving}>
            {saving
              ? "Saving..."
              : editingId
                ? "Update Showtime"
                : "Create Showtime"}
          </button>

          {editingId && (
            <button
              type="button"
              className="button button-secondary"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="table">
        {showtimes.map((s) => (
          <div className="table-row" key={s._id}>
            <strong>{s.movie?.title || "Unknown movie"}</strong>
            <span>{String(s.date).slice(0, 10)} · {s.startTime}</span>
            <span>{s.hall?.name || "Unknown hall"}</span>
            <span>RM {Number(s.price).toFixed(2)}</span>

            <div className="showtime-row-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => editShowtime(s)}
              >
                Edit
              </button>

              <button
                type="button"
                className="button button-danger"
                onClick={() => remove(s._id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {showtimes.length === 0 && (
          <p>No showtimes available. Create your first showtime above.</p>
        )}
      </div>
    </section>
  );
}
