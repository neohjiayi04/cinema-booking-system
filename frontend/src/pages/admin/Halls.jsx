import { useEffect, useRef, useState } from "react";
import { api } from "../../services/api.js";

const EMPTY_FORM = { name: "", rows: 5, seatsPerRow: 8 };

export default function Halls() {
  const [halls, setHalls] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const formRef = useRef(null);
  const nameRef = useRef(null);
  const isEditing = editingId !== null;

  /* READ */
  async function load() {
    try {
      setHalls(await api("/halls"));
    } catch (err) {
      setError(err.message || "Unable to load halls.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setField(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
    
  }

  function resetForm() {
    setForm(EMPTY_FORM);
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
    });
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      nameRef.current?.focus();
    });
  }

  /* DELETE */
  async function remove(hall) {
    if (!window.confirm(`Delete "${hall.name}"? This cannot be undone.`)) return;

    setMessage("");
    setError("");
    try {
      await api(`/halls/${hall._id}`, { method: "DELETE" });
      if (editingId === hall._id) resetForm();
      setMessage(`"${hall.name}" has been deleted.`);
      await load();
    } catch (err) {
      setError(err.message || "Unable to delete the hall.");
    }
  }

  const totalSeats = halls.reduce((sum, h) => sum + h.rows * h.seatsPerRow, 0);
  const previewSeats = (Number(form.rows) || 0) * (Number(form.seatsPerRow) || 0);

  return (
    <section>
      <div className="admin-page-header">
        <div>
          <h1>Halls</h1>
          <p className="admin-page-description">
            Manage and view all cinema halls.
          </p>
        </div>
      </div>
      {message && (
        <div className="admin-alert admin-alert-success admin-hall-alert" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="admin-alert admin-alert-error admin-hall-alert" role="alert">
          {error}
        </div>
      )}

      {/* Add / Edit form */}
      <div className="admin-panel" ref={formRef}>
        <div className="admin-panel-header">
          <div>
            <h2 className="admin-panel-title">
              {isEditing ? "Edit Hall" : "Add New Hall"}
            </h2>
            <p className="admin-panel-subtitle">
              {isEditing
                ? "Update the hall details, then save your changes."
                : "Set the name and seating layout for a new hall."}
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
                <label className="admin-label" htmlFor="hall-name">Hall name</label>
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
                <label className="admin-label" htmlFor="hall-rows">Rows</label>
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
                <label className="admin-label" htmlFor="hall-seats">Seats per row</label>
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
            </div>

            <div className="admin-form-actions">
              {isEditing && (
                <button
                type="submit"
                className="admin-btn admin-btn-primary"
                disabled={saving}
                >
                  {saving ? "Saving..." : isEditing ? "Save Changes" : "+ Add Hall"}
                </button>
              )}
                <button
                    type="button"
                    className="admin-btn admin-btn-secondary"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Cancel
                  </button>
            </div>
          </form>
        </div>
      </div>

      {/* Hall list */}
      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2 className="admin-panel-title">All Halls</h2>
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
            <div className="admin-empty-icon" aria-hidden="true">▤</div>
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {halls.map((hall) => (
                    <tr
                      key={hall._id}
                      className={hall._id === editingId ? "is-editing" : ""}
                    >
                      <td className="admin-cell-primary">{hall.name}</td>
                      <td>{hall.rows}</td>
                      <td>{hall.seatsPerRow}</td>
                      <td>
                        <strong>{hall.rows * hall.seatsPerRow}</strong>
                      </td>
                      <td>
                        <div className="admin-table-actions">
                          <button
                            type="button"
                            className="admin-btn admin-btn-secondary admin-btn-sm"
                            onClick={() => startEdit(hall)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-danger admin-btn-sm"
                            onClick={() => remove(hall)}
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

            <div className="admin-table-footer">
              <span>
                Total capacity: {totalSeats} seats across {halls.length}{" "}
                {halls.length === 1 ? "hall" : "halls"}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}