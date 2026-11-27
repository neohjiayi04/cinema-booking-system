import "../styles/ActionButton.css";

/*
  Shared action button with an icon in front of the text
  (same look as the Edit / Archive / Restore / Delete buttons on Movies).

    <div className="app-act-group">
      <ActionButton variant="edit" onClick={...}>Edit</ActionButton>
      <ActionButton variant="delete" onClick={...}>Delete</ActionButton>
    </div>

  variant: edit (indigo) | view (blue) | delete (red) | archive (amber)
           | restore (green) | save (green) | neutral (grey outline)
  icon:    optional override: edit | eye | trash | archive | restore | lock | check | x
  Disabled buttons turn into the grey hatched "locked" style; pass `title`
  to explain why (shown as a tooltip).
  Use className="app-act-group app-act-group--stack" for a vertical,
  full-width stack (e.g. inside a ticket card).
*/

const ICON_PATHS = {
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  archive: (
    <>
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" />
    </>
  ),
  restore: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
};

const DEFAULT_ICON = {
  edit: "edit",
  delete: "trash",
  archive: "archive",
  restore: "restore",
  save: "check",
  view: "eye",
  neutral: "x",
};

function ActionIcon({ name }) {
  return (
    <svg
      className="app-act-icon"
      width="15"
      height="15"
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

export default function ActionButton({
  variant = "neutral",
  icon,
  disabled = false,
  title,
  className = "",
  children,
  type = "button",
  ...rest
}) {
  const button = (
    <button
      type={type}
      className={`app-act app-act--${variant} ${className}`.trim()}
      disabled={disabled}
      title={title}
      {...rest}
    >
      <ActionIcon name={icon || DEFAULT_ICON[variant] || "x"} />
      {children}
    </button>
  );

  // A disabled button gets no hover events, so the tooltip lives on a wrapper.
  return disabled ? (
    <span className="app-act-wrap" title={title}>
      {button}
    </span>
  ) : (
    button
  );
}