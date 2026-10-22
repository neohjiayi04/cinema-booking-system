import { useEffect, useState } from "react";
import { api } from "../../services/api.js";

const empty = { title: "", description: "", genre: "General", duration: 120, rating: "PG", poster: "", releaseDate: "", status: "NOW_SHOWING" };

export default function Movies() {
  const [movies, setMovies] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");

  async function load() { setMovies(await api("/movies")); }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    if (editing) {
      await api(`/movies/${editing}`, { method: "PUT", body: JSON.stringify(form) });
    } else {
      await api("/movies", { method: "POST", body: JSON.stringify(form) });
    }
    setForm(empty); setEditing(null); load();
  }

  async function remove(id) {
    if (!confirm("Delete this movie?")) return;
    await api(`/movies/${id}`, { method: "DELETE" });
    load();
  }

  function edit(movie) {
    setEditing(movie._id);
    setForm({ ...empty, ...movie });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Extract unique genres for the filter dropdown
  const genres = ["All", ...new Set(movies.map(m => m.genre).filter(Boolean))];

  // Filter movies based on search query and selected genre
  const filteredMovies = movies.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesGenre = selectedGenre === "All" || m.genre === selectedGenre;
    return matchesSearch && matchesGenre;
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
                <label className="admin-form-label">Title</label>
                <input className="admin-form-input" placeholder="Enter movie title" value={form.title} onChange={e => setForm({...form,title:e.target.value})} required />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Genre</label>
                <input className="admin-form-input" placeholder="e.g. Action, Drama" value={form.genre} onChange={e => setForm({...form,genre:e.target.value})} />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Duration (minutes)</label>
                <input className="admin-form-input" placeholder="120" type="number" value={form.duration} onChange={e => setForm({...form,duration:e.target.value})} />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Rating</label>
                <input className="admin-form-input" placeholder="PG, R, 18+" value={form.rating} onChange={e => setForm({...form,rating:e.target.value})} />
              </div>

              <div className="admin-form-group full-width">
                <label className="admin-form-label">Poster URL</label>
                <input className="admin-form-input" placeholder="https://image-url.com/poster.jpg" value={form.poster} onChange={e => setForm({...form,poster:e.target.value})} />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Release Date</label>
                <input className="admin-form-input" type="date" value={form.releaseDate} onChange={e => setForm({...form,releaseDate:e.target.value})} />
              </div>

              <div className="admin-form-group full-width">
                <label className="admin-form-label">Description</label>
                <textarea className="admin-form-textarea" placeholder="Enter movie description..." value={form.description} onChange={e => setForm({...form,description:e.target.value})} rows={3} />
              </div>
            </div>

            <div className="admin-form-actions">
              <button className="button">{editing ? "Update Movie" : "Add Movie"}</button>
              {editing && (
                <button 
                  type="button" 
                  onClick={() => { setEditing(null); setForm(empty); }} 
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
            filteredMovies.map(m => (
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
                  <strong>{m.title}</strong>
                  <span className="table-row-subtitle">{m.genre} • {m.duration} min • {m.rating}</span>
                </div>

                <div className="table-actions">
                  <button className="table-action-btn" onClick={() => edit(m)}>Edit</button>
                  <button className="table-action-btn delete" onClick={() => remove(m._id)}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}