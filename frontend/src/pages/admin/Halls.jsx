import { useEffect, useState } from "react";
import { api } from "../../services/api.js";

export default function Halls() {
  const [halls, setHalls] = useState([]);
  const [form, setForm] = useState({ name: "", rows: 5, seatsPerRow: 8 });

  async function load() { setHalls(await api("/halls")); }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    await api("/halls", { method: "POST", body: JSON.stringify(form) });
    setForm({ name: "", rows: 5, seatsPerRow: 8 }); load();
  }

  async function remove(id) {
    if (!confirm("Delete this hall?")) return;
    await api(`/halls/${id}`, { method: "DELETE" }); load();
  }

  return (
    <section>
      <span className="eyebrow">ADMIN</span><h1>Hall Management</h1>
      <form className="admin-form inline" onSubmit={submit}>
        <input placeholder="Hall name" value={form.name} onChange={e => setForm({...form,name:e.target.value})} required />
        <input type="number" min="1" placeholder="Rows" value={form.rows} onChange={e => setForm({...form,rows:e.target.value})} />
        <input type="number" min="1" placeholder="Seats/row" value={form.seatsPerRow} onChange={e => setForm({...form,seatsPerRow:e.target.value})} />
        <button className="button">Add Hall</button>
      </form>
      <div className="table">
        {halls.map(h => (
          <div className="table-row" key={h._id}>
            <strong>{h.name}</strong><span>{h.rows} rows</span><span>{h.seatsPerRow} seats/row</span>
            <button onClick={() => remove(h._id)}>Delete</button>
          </div>
        ))}
      </div>
    </section>
  );
}
