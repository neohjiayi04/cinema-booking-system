import { useCallback, useEffect, useRef, useState } from "react";
import "../styles/Popup.css";

/*
  Shared centered pop-ups.
*/

export const NOTICE_MS = 4000;

/* Small inline icon set (24x24, stroke based) */
const ICON_PATHS = {
  check: <path d="M20 6 9 17l-5-5" />,
  error: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  alert: (
    <>
      <path d="m10.29 3.86-8.18 14.14A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-3l-8.18-14.14a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
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
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
};

function PopupIcon({ name }) {
  return (
    <svg
      className="app-popup-icon"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name] || ICON_PATHS.alert}
    </svg>
  );
}

/* Keeps the latest callback in a ref so effects don't restart on re-render */
function useLatest(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/* ---------------------------------------------------------
   Result message (success / error)
   --------------------------------------------------------- */
export function Popup({ type, message, onClose, duration = NOTICE_MS }) {
  const isError = type === "error";
  const closeRef = useLatest(onClose);

  // Esc closes the pop-up
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeRef]);

  // Success pop-ups close themselves; errors wait for a click.
  useEffect(() => {
    if (isError) return undefined;
    const t = setTimeout(() => closeRef.current(), duration);
    return () => clearTimeout(t);
  }, [isError, duration, closeRef]);

  return (
    <div className="app-popup-backdrop" onClick={onClose}>
      <div
        className={`app-popup app-popup--${type}`}
        role={isError ? "alertdialog" : "status"}
        aria-modal="true"
        aria-labelledby="app-popup-title"
        onClick={(e) => e.stopPropagation()}
        style={{ "--app-popup-time": `${duration}ms` }}
      >
        <span className="app-popup-badge">
          <PopupIcon name={isError ? "error" : "check"} />
        </span>

        <h3 className="app-popup-title" id="app-popup-title">
          {isError ? "Something went wrong" : "Success!"}
        </h3>

        <p className="app-popup-text">{message}</p>

        <button
          type="button"
          className="app-popup-btn"
          onClick={onClose}
          autoFocus
        >
          {isError ? "Got it" : "OK"}
        </button>

        {!isError && <span className="app-popup-timer" aria-hidden="true" />}
      </div>
    </div>
  );
}

/* Shows the error pop-up first; otherwise the success one. */
export default function PopupHost({
  error,
  notice,
  onCloseError,
  onCloseNotice,
}) {
  if (error) {
    return (
      <Popup
        key={`e-${error}`}
        type="error"
        message={error}
        onClose={onCloseError}
      />
    );
  }

  if (notice) {
    return (
      <Popup
        key={`n-${notice}`}
        type="success"
        message={notice}
        onClose={onCloseNotice}
      />
    );
  }

  return null;
}

/* ---------------------------------------------------------
   Confirmation dialog (replaces window.confirm)
   --------------------------------------------------------- */
export function ConfirmDialog({
  title = "Are you sure?",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  tone = "danger",
  icon,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useLatest(onCancel);

  // Esc = cancel
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") cancelRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelRef]);

  const iconName = icon || (tone === "info" ? "help" : "alert");

  return (
    <div className="app-popup-backdrop" onClick={onCancel}>
      <div
        className={`app-popup app-popup--${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-confirm-title"
        aria-describedby="app-confirm-text"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="app-popup-badge">
          <PopupIcon name={iconName} />
        </span>

        <h3 className="app-popup-title" id="app-confirm-title">
          {title}
        </h3>

        <p className="app-popup-text" id="app-confirm-text">
          {message}
        </p>

        <div className="app-popup-actions">
          {/* Safe default: focus starts on Cancel */}
          <button
            type="button"
            className="app-popup-btn app-popup-btn--ghost"
            onClick={onCancel}
            autoFocus
          >
            {cancelText}
          </button>

          <button type="button" className="app-popup-btn" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/*
  const [askConfirm, confirmDialog] = useConfirm();
  askConfirm(options) returns a Promise<boolean>, so it reads like
  window.confirm:   if (!(await askConfirm({...}))) return;
*/
export function useConfirm() {
  const [options, setOptions] = useState(null);
  const resolverRef = useRef(null);

  const askConfirm = useCallback((opts) => {
    return new Promise((resolve) => {
      resolverRef.current?.(false); // settle any dialog that was still open
      resolverRef.current = resolve;
      setOptions(opts || {});
    });
  }, []);

  const settle = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  // If the page unmounts while a dialog is open, treat it as "cancel".
  useEffect(() => {
    return () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    };
  }, []);

  const confirmDialog = options ? (
    <ConfirmDialog
      {...options}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;

  return [askConfirm, confirmDialog];
}