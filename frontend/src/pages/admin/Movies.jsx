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
import "../../styles/AdminMovies.css";

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

// Success pop-ups close by themselves after this long (ms).
// Error pop-ups stay until the admin closes them, so they can't be missed.
const NOTICE_MS = 4000;

/* Small inline icon set (24x24, stroke based) */
const ICON_PATHS = {
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  alert: (<><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>),
  info: (<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>),
  star: <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
  edit: (<><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>),
  archive: (<><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" /></>),
  restore: (<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>),
  trash: (<><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></>),
  lock: (<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>),
  calendar: (<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
  search: (<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>),
  film: (<><rect x="2" y="2" width="20" height="20" rx="2.18" /><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" /></>)
};

function Icon({ name, size = 16 }) {
  return (
    <svg
      className="mv-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/* Centered pop-up message (success / error) */
function Popup({ type, message, onClose }) {
  const isError = type === "error";

  // Esc closes the pop-up
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="mv-popup-backdrop" onClick={onClose}>
      <div
        className={`mv-popup mv-popup--${type}`}
        role={isError ? "alertdialog" : "status"}
        aria-modal="true"
        aria-labelledby="mv-popup-title"
        onClick={(e) => e.stopPropagation()}
        style={{ "--mv-popup-time": `${NOTICE_MS}ms` }}
      >
        <span className="mv-popup-badge">
          <Icon name={isError ? "alert" : "check"} size={40} />
        </span>
        <h3 className="mv-popup-title" id="mv-popup-title">
          {isError ? "Something went wrong" : "Success!"}
        </h3>
        <p className="mv-popup-text">{message}</p>
        <button type="button" className="mv-popup-btn" onClick={onClose} autoFocus>
          {isError ? "Got it" : "OK"}
        </button>
        {!isError && <span className="mv-popup-timer" aria-hidden="true" />}
      </div>
    </div>
  );
}

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

  // Success pop-ups close themselves after a few seconds (errors wait for a click).
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(""), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);


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
      <div className="mv-page">
        {/* Centered pop-up messages */}
        {error && <Popup key={`e-${error}`} type="error" message={error} onClose={() => setError("")} />}
        {!error && notice && <Popup key={`n-${notice}`} type="success" message={notice} onClose={() => setNotice("")} />}

        <div className="admin-page-header">
          <div>
            <h1>Movies</h1>
            <p className="admin-page-description">
              Add new movies to your cinema or browse and manage existing ones.
            </p>
          </div>
        </div>

        {/* SECTION 1: ADD / EDIT MOVIE */}
        <div className={`mv-card ${editing ? "is-editing" : ""}`}>
          <h2 className="mv-card-title">
            {editing ? "Edit Movie Details" : "Add New Movie"}
            {editing && <span className="mv-editing-pill">Editing</span>}
          </h2>

          <form className="mv-form" onSubmit={submit}>
            {/* Left Side: Poster Preview Panel */}
            <div className="mv-poster">
              <span className="mv-label">Poster Preview</span>
              <div className="mv-poster-box">
                {form.poster ? (
                  <img
                    src={form.poster}
                    alt="Movie Poster Preview"
                    className="mv-poster-img"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="mv-poster-empty">
                    <Icon name="film" size={28} />
                    <span>No Poster Image</span>
                  </div>
                )}
              </div>
              <p className="mv-hint">Paste a valid image URL on the right to preview.</p>
            </div>

            {/* Right Side: Form Fields (compact: 4 rows) */}
            <div className="mv-fields">
              <div className="mv-grid">
                <div className="mv-field mv-col-title">
                  <label className="mv-label" htmlFor="movie-title">Title</label>
                  <input id="movie-title" className="mv-input" placeholder="Enter movie title" value={form.title} onChange={e => setForm({...form,title:e.target.value})} required />
                </div>

                <div className="mv-field mv-col-genre">
                  <label className="mv-label" htmlFor="movie-genre">Genre</label>
                  <select id="movie-genre" className="mv-input mv-select" value={form.genre} onChange={e => setForm({...form,genre:e.target.value})} required>
                    <option value="" disabled>Select genre</option>
                    {genreOptions.map(g => (
                      <option key={g} value={g}>{GENRES.includes(g) ? g : `${g} (current)`}</option>
                    ))}
                  </select>
                </div>

                <div className="mv-field mv-col-rating">
                  <label className="mv-label" htmlFor="movie-rating">Rating</label>
                  <select id="movie-rating" className="mv-input mv-select" value={form.rating} onChange={e => setForm({...form,rating:e.target.value})} required>
                    <option value="" disabled>Select rating</option>
                    {ratingOptions.map(r => (
                      <option key={r} value={r}>{RATINGS.includes(r) ? r : `${r} (current)`}</option>
                    ))}
                  </select>
                </div>

                <div className="mv-field mv-col-duration">
                  <label className="mv-label" htmlFor="movie-duration">Duration (min)</label>
                  <input id="movie-duration" className="mv-input" placeholder="120" type="number" min="1" max="600" value={form.duration} onChange={e => setForm({...form,duration:e.target.value})} />
                </div>

                <div className="mv-field mv-col-full">
                  <label className="mv-label" htmlFor="movie-poster">Poster URL</label>
                  <input id="movie-poster" className="mv-input" placeholder="https://image-url.com/poster.jpg" value={form.poster} onChange={e => setForm({...form,poster:e.target.value})} />
                </div>

                <div className="mv-field mv-col-date">
                  <label className="mv-label" htmlFor="movie-start">Start Date (Release)</label>
                  <input id="movie-start" className="mv-input" type="date" value={form.releaseDate} onChange={e => setForm({...form,releaseDate:e.target.value})} required />
                </div>

                <div className="mv-field mv-col-date">
                  <label className="mv-label" htmlFor="movie-end">End Date</label>
                  <input id="movie-end" className="mv-input" type="date" min={form.releaseDate || undefined} value={form.endDate} onChange={e => setForm({...form,endDate:e.target.value})} required aria-invalid={Boolean(dateError)} />
                  {dateError && <span className="mv-field-error" role="alert">{dateError}</span>}
                </div>

                <div className="mv-field mv-col-feature">
                  <span className="mv-label">Homepage Featured Movie</span>
                  <label className={`mv-feature ${form.featured ? "is-on" : ""}`}>
                    <input
                      type="checkbox"
                      className="mv-feature-input"
                      checked={form.featured}
                      onChange={e => setForm({ ...form, featured: e.target.checked })}
                    />
                    <span className="mv-feature-icon"><Icon name="star" size={18} /></span>
                    <span className="mv-feature-text">Display this movie as a Featured movie on the homepage</span>
                    <span className="mv-switch" aria-hidden="true" />
                  </label>
                </div>

                <div className="mv-field mv-col-full">
                  <label className="mv-label" htmlFor="movie-description">Description</label>
                  <textarea id="movie-description" className="mv-input mv-textarea" placeholder="Enter movie description..." value={form.description} onChange={e => setForm({...form,description:e.target.value})} rows={2} />
                </div>
              </div>

              {/* Status note + buttons share one row */}
              <div className="mv-actions">
                <p className="mv-note">
                  <Icon name="info" size={16} />
                  <span>
                    Status is automatic: <strong>Coming Soon</strong> before the start date,
                    {" "}<strong>Now Showing</strong> between the start and end dates, and
                    {" "}<strong>Ended</strong> after the end date. Only Now Showing movies can be booked.
                  </span>
                </p>

                <div className="mv-actions-btns">
                  <button className="mv-btn mv-btn--primary" disabled={saving || Boolean(dateError)}>{editing ? "Update Movie" : "Add Movie"}</button>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => { setEditing(null); setForm(empty); setError(""); }}
                      className="mv-btn mv-btn--ghost"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* SECTION 2: VIEW & MANAGE MOVIES */}
        <div className="mv-card">
          <h2 className="mv-card-title">View &amp; Manage Movies</h2>

          {/* Status tabs */}
          <div className="mv-tabs" role="tablist" aria-label="Filter by status">
            {STATUS_TABS.map(tab => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={statusTab === tab}
                className={`mv-tab mv-tab--${tab.toLowerCase().replace("_", "-")} ${statusTab === tab ? "active" : ""}`}
                onClick={() => setStatusTab(tab)}
              >
                <span className="mv-tab-dot" aria-hidden="true" />
                {tab === "ALL" ? "All" : MOVIE_STATUS_LABELS[tab]} <span className="mv-tab-count">{countFor(tab)}</span>
              </button>
            ))}
          </div>

          {/* Search and Filter Controls in One Row */}
          <div className="mv-controls">
            <div className="mv-search">
              <Icon name="search" size={17} />
              <input
                type="text"
                placeholder="Search by title or description..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="mv-input mv-search-input"
              />
            </div>
            <select
              aria-label="Filter by genre"
              value={selectedGenre}
              onChange={e => setSelectedGenre(e.target.value)}
              className="mv-input mv-select mv-genre-filter"
            >
              {genres.map(g => (
                <option key={g} value={g}>{g === "All" ? "All Genres" : g}</option>
              ))}
            </select>
          </div>

          {/* Movie List */}
          <div className="mv-list">
            {filteredMovies.length === 0 ? (
              <div className="mv-empty">
                <Icon name="film" size={30} />
                <p>No movies found.</p>
              </div>
            ) : (
              filteredMovies.map(m => {
                const status = statusOf(m);
                const bookingCount = m.bookingCount || 0;
                const locked = bookingCount > 0;
                const archiveReason = locked ? "This movie has bookings, so it can't be archived." : "Archive movie";
                const deleteReason = locked ? "This movie has bookings, so it can't be deleted. Archive it instead." : "Delete movie";
                return (
                  <div className={`mv-row ${editing === m._id ? "is-editing" : ""}`} key={m._id}>
                    {m.poster ? (
                      <img
                        src={m.poster}
                        alt={m.title}
                        className="mv-thumb"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="mv-thumb mv-thumb--empty">No Img</div>
                    )}

                    <div className="mv-row-info">
                      <div className="mv-row-title">
                        <strong>{m.title}</strong>
                        <span className={`mv-badge mv-badge--${status.toLowerCase().replace("_", "-")}`}>
                          {MOVIE_STATUS_LABELS[status]}
                        </span>
                        {m.featured === true && (
                          <span className="mv-badge mv-badge--featured">
                            <Icon name="star" size={11} /> Featured
                          </span>
                        )}
                      </div>

                      <span className="mv-row-meta">{m.genre} • {m.duration} min • {m.rating}</span>
                      {m.releaseDate && (
                        <span className="mv-row-meta mv-row-dates">
                          <Icon name="calendar" size={13} />
                          {formatDate(m.releaseDate)} → {m.endDate ? formatDate(m.endDate) : "No end date"}
                          {locked && (
                            <span className="mv-lock-chip" title="Movies with bookings can't be archived or deleted.">
                              <Icon name="lock" size={11} /> {bookingCount} booking{bookingCount === 1 ? "" : "s"}
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    <div className="mv-row-actions">
                      <button className="mv-act mv-act--edit" onClick={() => edit(m)}>
                        <Icon name="edit" size={15} /> Edit
                      </button>

                      {status === MOVIE_STATUS.ARCHIVED ? (
                        <button className="mv-act mv-act--restore" onClick={() => restore(m)}>
                          <Icon name="restore" size={15} /> Restore
                        </button>
                      ) : (
                        <span className="mv-act-wrap" title={archiveReason}>
                          <button
                            className="mv-act mv-act--archive"
                            onClick={() => archive(m)}
                            disabled={locked}
                            title={archiveReason}
                          >
                            <Icon name={locked ? "lock" : "archive"} size={15} /> Archive
                          </button>
                        </span>
                      )}

                      <span className="mv-act-wrap" title={deleteReason}>
                        <button
                          className="mv-act mv-act--delete"
                          onClick={() => remove(m)}
                          disabled={locked}
                          title={deleteReason}
                        >
                          <Icon name={locked ? "lock" : "trash"} size={15} /> Delete
                        </button>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}