import { useEffect, useState } from "react";
import { api } from "../../services/api.js";
import {
  GENRES,
  RATINGS,
  MOVIE_STATUS,
  MOVIE_STATUS_LABELS,
  statusOf,
  formatDate,
  cleanError
} from "../../constants/movieOptions.js";

const empty = {
  title: "",
  description: "",
  genre: "",
  duration: 120,
  rating: "",
  poster: "",
  releaseDate: "",
  endDate: "",
  featured: false
};

const STATUS_TABS = ["ALL", "NOW_SHOWING", "COMING_SOON", "ENDED", "ARCHIVED"];

export default function Movies() {
  const [movies, setMovies] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [statusTab, setStatusTab] = useState("ALL");

  async function load() { setMovies(await api("/admin/movies")); }

  useEffect(() => {
    let cancelled = false;
    api("/admin/movies")
      .then((data) => { if (!cancelled) setMovies(data); })
      .catch((e) => { if (!cancelled) setError(cleanError(e, "Unable to load movies.")); });
    return () => { cancelled = true; };
  }, []);

  // Business rule: the end date can't be earlier than the start date.
  const dateError =
    form.releaseDate && form.endDate && form.endDate < form.releaseDate
      ? "End date cannot be earlier than the start date."
      : "";

  // Genre/Rating are dropdowns. A value typed in by hand before this change is
  // kept as an extra option so old movies can still be edited.
  const genreOptions = !form.genre || GENRES.includes(form.genre) ? GENRES : [form.genre, ...GENRES];
  const ratingOptions = !form.rating || RATINGS.includes(form.rating) ? RATINGS : [form.rating, ...RATINGS];

  async function submit(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (dateError) { setError(dateError); return; }

    const payload = {
      title: form.title,
      description: form.description,
      genre: form.genre,
      duration: Number(form.duration),
      rating: form.rating,
      poster: form.poster,
      releaseDate: form.releaseDate,
      endDate: form.endDate || null,
      featured: form.featured  === true 
    };

    setSaving(true);
    try {
      if (editing) {
        await api(`/movies/${editing}`, { method: "PUT", body: JSON.stringify(payload) });
        setNotice("Movie updated.");
      } else {
        await api("/movies", { method: "POST", body: JSON.stringify(payload) });
        setNotice("Movie added.");
      }
      setForm(empty);
      setEditing(null);
      await load();
    } catch (err) {
      setError(cleanError(err, "Failed to save the movie."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(movie) {
    if (!confirm("Delete this movie?")) return;
    setError("");
    setNotice("");
    try {
      await api(`/movies/${movie._id}`, { method: "DELETE" });
      setNotice("Movie deleted.");
      await load();
    } catch (err) {
      // e.g. the movie has bookings: the server tells the admin to archive it
      setError(cleanError(err, "Failed to delete the movie."));
    }
  }

  async function archive(movie) {
    if (!confirm(`Archive "${movie.title}"? It will be hidden from customers and can't be booked. You can restore it later.`)) return;
    setError("");
    setNotice("");
    try {
      await api(`/movies/${movie._id}/archive`, { method: "PUT" });
      setNotice(`"${movie.title}" archived.`);
      await load();
    } catch (err) {
      setError(cleanError(err, "Failed to archive the movie."));
    }
  }

  async function restore(movie) {
    setError("");
    setNotice("");
    try {
      await api(`/movies/${movie._id}/restore`, { method: "PUT" });
      setNotice(`"${movie.title}" restored.`);
      await load();
    } catch (err) {
      setError(cleanError(err, "Failed to restore the movie."));
    }
  }

  function edit(movie) {
    setEditing(movie._id);
    setError("");
    setNotice("");
    setForm({
      ...empty,
      title: movie.title || "",
      description: movie.description || "",
      genre: movie.genre || "",
      duration: movie.duration ?? 120,
      rating: movie.rating || "",
      poster: movie.poster || "",
      releaseDate: String(movie.releaseDate || "").slice(0, 10),
      endDate: String(movie.endDate || "").slice(0, 10),
      featured: movie.featured === true
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Extract unique genres for the filter dropdown
  const genres = ["All", ...new Set(movies.map(m => m.genre).filter(Boolean))];

  const countFor = (tab) =>
    tab === "ALL" ? movies.length : movies.filter(m => statusOf(m) === tab).length;

  // Filter movies based on status tab, search query and selected genre
  const filteredMovies = movies.filter(m => {
    const matchesStatus = statusTab === "ALL" || statusOf(m) === statusTab;
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesGenre = selectedGenre === "All" || m.genre === selectedGenre;
    return matchesStatus && matchesSearch && matchesGenre;
  });

  return (
    <section>
      <div className="admin-page-header">
        <div>
          <h1>Movies</h1>
          <p className="admin-page-description">
            Add new movies to your cinema or browse and manage existing ones.
          </p>
        </div>
      </div>

      {error && <div role="alert" className="admin-alert admin-alert-error">{error}</div>}
      {notice && <div role="status" className="admin-alert admin-alert-success">{notice}</div>}

      {/* SECTION 1: ADD / EDIT MOVIE */}
      <div className="admin-section">
        <h2 className="admin-section-title">
          {editing ? "Edit Movie Details" : "Add New Movie"}
        </h2>

        <form className="admin-form-split" onSubmit={submit}>
          {/* Left Side: Poster Preview Panel */}
          <div className="admin-poster-panel">
            <label className="admin-form-label">Poster Preview</label>
            <div className="admin-poster-preview-box">
              {form.poster ? (
                <img
                  src={form.poster}
                  alt="Movie Poster Preview"
                  className="admin-poster-img"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="admin-poster-placeholder">
                  <span>No Poster Image</span>
                </div>
              )}
            </div>
            <p className="admin-poster-hint">Paste a valid image URL on the right to preview.</p>
          </div>

          {/* Right Side: Form Fields */}
          <div className="admin-form-fields-container">
            <div className="admin-form-grid">
              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="movie-title">Title</label>
                <input id="movie-title" className="admin-form-input" placeholder="Enter movie title" value={form.title} onChange={e => setForm({...form,title:e.target.value})} required />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="movie-genre">Genre</label>
                <select id="movie-genre" className="admin-select" value={form.genre} onChange={e => setForm({...form,genre:e.target.value})} required>
                  <option value="" disabled>Select genre</option>
                  {genreOptions.map(g => (
                    <option key={g} value={g}>{GENRES.includes(g) ? g : `${g} (current)`}</option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="movie-duration">Duration (minutes)</label>
                <input id="movie-duration" className="admin-form-input" placeholder="120" type="number" min="1" max="600" value={form.duration} onChange={e => setForm({...form,duration:e.target.value})} />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="movie-rating">Rating</label>
                <select id="movie-rating" className="admin-select" value={form.rating} onChange={e => setForm({...form,rating:e.target.value})} required>
                  <option value="" disabled>Select rating</option>
                  {ratingOptions.map(r => (
                    <option key={r} value={r}>{RATINGS.includes(r) ? r : `${r} (current)`}</option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group full-width">
                <label className="admin-form-label" htmlFor="movie-poster">Poster URL</label>
                <input id="movie-poster" className="admin-form-input" placeholder="https://image-url.com/poster.jpg" value={form.poster} onChange={e => setForm({...form,poster:e.target.value})} />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="movie-start">Start Date (Release)</label>
                <input id="movie-start" className="admin-form-input" type="date" value={form.releaseDate} onChange={e => setForm({...form,releaseDate:e.target.value})} required />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="movie-end">End Date</label>
                <input id="movie-end" className="admin-form-input" type="date" min={form.releaseDate || undefined} value={form.endDate} onChange={e => setForm({...form,endDate:e.target.value})} required aria-invalid={Boolean(dateError)} />
                {dateError && <span className="admin-field-error" role="alert">{dateError}</span>}
              </div>

              <div className="admin-form-group full-width">
                <label className="admin-form-label" htmlFor="movie-description">Description</label>
                <textarea id="movie-description" className="admin-form-textarea" placeholder="Enter movie description..." value={form.description} onChange={e => setForm({...form,description:e.target.value})} rows={3} />
              </div>
            </div>

            <div className="admin-form-group full-width">
              <label className="admin-form-label" style={{ marginTop: "4px" }}>
                Homepage Featured Movie
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={e => setForm({ ...form, featured: e.target.checked })}
                />
                <span className="admin-form-note">Display this movie as a Featured movie on the homepage</span>
              </label>
            </div>

            <p className="admin-form-note">
              Status is automatic: <strong>Coming Soon</strong> before the start date,
              {" "}<strong>Now Showing</strong> between the start and end dates, and
              {" "}<strong>Ended</strong> after the end date. Only Now Showing movies can be booked.
            </p>

            <div className="admin-form-actions">
              <button className="button" disabled={saving || Boolean(dateError)}>{editing ? "Update Movie" : "Add Movie"}</button>
              {editing && (
                <button
                  type="button"
                  onClick={() => { setEditing(null); setForm(empty); setError(""); }}
                  className="button-cancel"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* SECTION 2: VIEW & MANAGE MOVIES */}
      <div className="admin-section">
        <h2 className="admin-section-title">View & Manage Movies</h2>

        {/* Status tabs */}
        <div className="admin-status-tabs" role="tablist" aria-label="Filter by status">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={statusTab === tab}
              className={`admin-status-tab ${statusTab === tab ? "active" : ""}`}
              onClick={() => setStatusTab(tab)}
            >
              {tab === "ALL" ? "All" : MOVIE_STATUS_LABELS[tab]} <span className="admin-status-count">{countFor(tab)}</span>
            </button>
          ))}
        </div>

        {/* Search and Filter Controls in One Row */}
        <div className="admin-controls">
          <input
            type="text"
            placeholder="Search by title or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="admin-search-input"
          />
          <select
            aria-label="Filter by genre"
            value={selectedGenre}
            onChange={e => setSelectedGenre(e.target.value)}
            className="admin-select"
          >
            {genres.map(g => (
              <option key={g} value={g}>{g === "All" ? "All Genres" : g}</option>
            ))}
          </select>
        </div>

        {/* Movie List */}
        <div className="table">
          {filteredMovies.length === 0 ? (
            <p className="no-movies-text">No movies found.</p>
          ) : (
            filteredMovies.map(m => {
              const status = statusOf(m);
              const bookingCount = m.bookingCount || 0;
              return (
                <div className="table-row" key={m._id}>
                  {m.poster ? (
                    <img
                      src={m.poster}
                      alt={m.title}
                      className="table-row-thumb"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="table-row-thumb-placeholder">No Img</div>
                  )}

                  <div className="table-row-info">
                    <strong>
                      {m.title}{" "}
                      <span className={`movie-status-badge status-${status.toLowerCase().replace("_", "-")}`}>
                        {MOVIE_STATUS_LABELS[status]}
                      </span>

                      {m.featured === true && (
                        <span className="movie-featured-badge">
                          Featured
                        </span>
                      )}
                    </strong>

                    <span className="table-row-subtitle">{m.genre} • {m.duration} min • {m.rating}</span>
                    {m.releaseDate && (
                      <span className="table-row-subtitle">
                        {formatDate(m.releaseDate)} → {m.endDate ? formatDate(m.endDate) : "No end date"}
                        {bookingCount > 0 && ` • ${bookingCount} booking${bookingCount === 1 ? "" : "s"}`}
                      </span>
                    )}
                  </div>

                  <div className="table-actions">
                    <button className="table-action-btn" onClick={() => edit(m)}>Edit</button>
                    {status === MOVIE_STATUS.ARCHIVED ? (
                      <button className="table-action-btn" onClick={() => restore(m)}>Restore</button>
                    ) : (
                      <button
                        className="table-action-btn"
                        onClick={() => archive(m)}
                        disabled={bookingCount > 0}
                        title={
                          bookingCount > 0
                            ? "This movie has bookings, so it can't be archived."
                            : "Archive movie"
                        }
                      >
                        Archive
                      </button>
                    )}
                    <button
                      className="table-action-btn delete"
                      onClick={() => remove(m)}
                      disabled={bookingCount > 0}
                      title={bookingCount > 0 ? "This movie has bookings, so it can't be deleted. Archive it instead." : "Delete movie"}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}