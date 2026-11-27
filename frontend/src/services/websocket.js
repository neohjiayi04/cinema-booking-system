const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";

// VITE_WS_URL may be a full URL (ws://host:3001), a same-origin path (/ws, used
// behind the nginx proxy in Docker) or unset (dev: backend on port 3001 of the
// same host the page was loaded from).
function resolveWsUrl() {
  const configured = import.meta.env.VITE_WS_URL;
  if (!configured) return `${wsScheme}://${window.location.hostname}:3001`;
  if (configured.startsWith("/")) return `${wsScheme}://${window.location.host}${configured}`;
  return configured;
}

const WS_URL = resolveWsUrl();

/**
 * Joins the live seat updates of one showtime.
 *
 * Returns the first WebSocket; calling close() on it stops the connection for good
 * (including any automatic reconnection). If the connection drops, it reconnects
 * with a growing delay (1s, 2s, 4s ... up to 15s) and re-joins the showtime.
 *
 * options.onDisconnect() runs when the socket closes unexpectedly.
 * options.onReconnect() runs after a successful re-connection: seat events sent
 * while the client was offline are lost, so the page should reload its seat map.
 */
export function connectShowtime(showtimeId, onMessage, options = {}) {
  let closedByUser = false;
  let attempts = 0;
  let timer = null;
  let current = null;

  function open() {
    const socket = new WebSocket(WS_URL);
    current = socket;

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({
        type: "JOIN_SHOWTIME",
        showtimeId
      }));

      if (attempts > 0) options.onReconnect?.();
      attempts = 0;
    });

    socket.addEventListener("message", event => {
      try {
        onMessage(JSON.parse(event.data));
      } catch (error) {
        console.error("WebSocket error:", error);
      }
    });

    socket.addEventListener("close", () => {
      if (closedByUser || socket !== current) return;

      options.onDisconnect?.();
      attempts += 1;
      const delay = Math.min(1000 * 2 ** (attempts - 1), 15000);
      timer = setTimeout(open, delay);
    });

    return socket;
  }

  const first = open();

  first.close = (...args) => {
    closedByUser = true;
    clearTimeout(timer);
    WebSocket.prototype.close?.apply(current, args);
  };

  return first;
}