const WS_URL = import.meta.env.VITE_WS_URL || `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:3001`;

export function connectShowtime(showtimeId, onMessage) {
  const socket = new WebSocket(WS_URL);

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({
      type: "JOIN_SHOWTIME",
      showtimeId
    }));
  });

  socket.addEventListener("message", event => {
    try {
      onMessage(JSON.parse(event.data));
    } catch (error) {
        console.error("WebSocket error:", error);    }
  });

  return socket;
}
