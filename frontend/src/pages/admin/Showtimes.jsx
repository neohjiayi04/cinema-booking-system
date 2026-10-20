import { useEffect, useState } from "react";
import { api } from "../../services/api.js";

export default function Showtimes() {
  const [movies, setMovies] = useState([]);
  const [halls, setHalls] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [form, setForm] = useState({ movieId: "", hallId: "", date: "", startTime: "", price: 18 });

  async function load() {
    const [m, h, s] = await Promise.all([api("/movies"), api("/halls"), api("/showtimes")]);
    setMovies(m); setHalls(h); setShowtimes(s);
    setForm(f => ({ ...f, movieId: f.movieId || m[0]?._id, hallId: f.hallId || h[0]?._id }));
  }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    await api("/showtimes", { method: "POST", body: JSON.stringify(form) });
    setForm(f => ({ ...f, date: "", startTime: "" })); load();
  }

  async function remove(id) {
    if (!confirm("Delete this showtime?")) return;
    await api(`/showtimes/${id}`, { method: "DELETE" }); load();
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
      
      <form className="admin-form" onSubmit={submit}>
        <select value={form.movieId} onChange={e => setForm({...form,movieId:e.target.value})}>
          {movies.map(m => <option key={m._id} value={m._id}>{m.title}</option>)}
        </select>
        <select value={form.hallId} onChange={e => setForm({...form,hallId:e.target.value})}>
          {halls.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
        </select>
        <input type="date" value={form.date} onChange={e => setForm({...form,date:e.target.value})} required />
        <input type="time" value={form.startTime} onChange={e => setForm({...form,startTime:e.target.value})} required />
        <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({...form,price:e.target.value})} />
        <button className="button">Create Showtime</button>
      </form>

      <div className="table">
        {showtimes.map(s => (
          <div className="table-row" key={s._id}>
            <strong>{s.movie.title}</strong>
            <span>{s.date} · {s.startTime}</span>
            <span>{s.hall.name}</span>
            <span>RM {s.price}</span>
            <button onClick={() => remove(s._id)}>Delete</button>
          </div>
        ))}
      </div>
    </section>
  );
}
