import { useEffect, useState } from "react";
import { api } from "../../services/api.js";

const empty = { title: "", description: "", genre: "General", duration: 120, rating: "PG", poster: "", releaseDate: "", status: "NOW_SHOWING" };

export default function Movies() {
  const [movies, setMovies] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);

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
  }

  return (
    <section>
      <span className="eyebrow">ADMIN</span><h1>Movie Management</h1>
      <form className="admin-form" onSubmit={submit}>
        <input placeholder="Title" value={form.title} onChange={e => setForm({...form,title:e.target.value})} required />
        <input placeholder="Genre" value={form.genre} onChange={e => setForm({...form,genre:e.target.value})} />
        <input placeholder="Duration" type="number" value={form.duration} onChange={e => setForm({...form,duration:e.target.value})} />
        <input placeholder="Rating" value={form.rating} onChange={e => setForm({...form,rating:e.target.value})} />
        <input placeholder="Poster URL" value={form.poster} onChange={e => setForm({...form,poster:e.target.value})} />
        <input placeholder="Release date" type="date" value={form.releaseDate} onChange={e => setForm({...form,releaseDate:e.target.value})} />
        <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form,description:e.target.value})} />
        <button className="button">{editing ? "Update Movie" : "Add Movie"}</button>
      </form>

      <div className="table">
        {movies.map(m => (
          <div className="table-row" key={m._id}>
            <strong>{m.title}</strong><span>{m.genre}</span><span>{m.duration} min</span>
            <button onClick={() => edit(m)}>Edit</button><button onClick={() => remove(m._id)}>Delete</button>
          </div>
        ))}
      </div>
    </section>
  );
}
