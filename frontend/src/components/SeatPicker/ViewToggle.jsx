// 2D / 3D switch for the seat page. The parent owns the state: <ViewToggle value={mode} onChange={setMode} />
const OPTIONS = [
  { value: "2d", label: "2D Flat" },
  { value: "3d", label: "3D View" },
];

export default function ViewToggle({ value, onChange }) {
  return (
    <div className="sp-modes-row">
      <div className="sp-modes" role="group" aria-label="Seat map view">
        {OPTIONS.map((o) => (
          <button
            type="button"
            key={o.value}
            className={`sp-mode ${value === o.value ? "sp-mode-on" : ""}`}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}