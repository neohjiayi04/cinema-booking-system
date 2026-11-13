import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectShowtime } from "./websocket.js";

class MockWebSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.listeners = {};
    this.sentMessages = [];

    MockWebSocket.instances.push(this);
  }

  addEventListener(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }

    this.listeners[event].push(callback);
  }

  send(message) {
    this.sentMessages.push(message);
  }

  trigger(event, data = {}) {
    const callbacks = this.listeners[event] || [];

    callbacks.forEach((callback) => callback(data));
  }
}

describe("connectShowtime", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];

    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates a WebSocket connection using the default URL", () => {
    const onMessage = vi.fn();

    const socket = connectShowtime("showtime123", onMessage);

    expect(socket).toBeInstanceOf(MockWebSocket);
    expect(socket.url).toBe("ws://localhost:3000");
  });

  it("returns the created WebSocket instance", () => {
    const onMessage = vi.fn();

    const socket = connectShowtime("showtime123", onMessage);

    expect(socket).toBe(MockWebSocket.instances[0]);
  });

  it("registers open and message event listeners", () => {
    const onMessage = vi.fn();

    const socket = connectShowtime("showtime123", onMessage);

    expect(socket.listeners.open).toHaveLength(1);
    expect(socket.listeners.message).toHaveLength(1);
  });

  it("joins the requested showtime when the connection opens", () => {
    const onMessage = vi.fn();

    const socket = connectShowtime("showtime123", onMessage);

    socket.trigger("open");

    expect(socket.sentMessages).toHaveLength(1);

    expect(JSON.parse(socket.sentMessages[0])).toEqual({
      type: "JOIN_SHOWTIME",
      showtimeId: "showtime123",
    });
  });

  it("does not send the join message before the connection opens", () => {
    const onMessage = vi.fn();

    const socket = connectShowtime("showtime123", onMessage);

    expect(socket.sentMessages).toHaveLength(0);
  });

  it("passes parsed incoming messages to the callback", () => {
    const onMessage = vi.fn();

    const socket = connectShowtime("showtime123", onMessage);

    const message = {
      type: "SEAT_UPDATE",
      seatId: "A1",
      status: "booked",
    };

    socket.trigger("message", {
      data: JSON.stringify(message),
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(message);
  });

  it("handles multiple incoming messages", () => {
    const onMessage = vi.fn();

    const socket = connectShowtime("showtime123", onMessage);

    const firstMessage = {
      type: "SEAT_UPDATE",
      seatId: "A1",
    };

    const secondMessage = {
      type: "SEAT_UPDATE",
      seatId: "A2",
    };

    socket.trigger("message", {
      data: JSON.stringify(firstMessage),
    });

    socket.trigger("message", {
      data: JSON.stringify(secondMessage),
    });

    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onMessage).toHaveBeenNthCalledWith(1, firstMessage);
    expect(onMessage).toHaveBeenNthCalledWith(2, secondMessage);
  });

  it("logs an error when an incoming message contains invalid JSON", () => {
    const onMessage = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const socket = connectShowtime("showtime123", onMessage);

    socket.trigger("message", {
      data: "invalid-json",
    });

    expect(consoleError).toHaveBeenCalledWith(
      "WebSocket error:",
      expect.any(Error)
    );

    expect(onMessage).not.toHaveBeenCalled();
  });

  it("catches errors thrown by the message callback", () => {
    const callbackError = new Error("Callback failed.");

    const onMessage = vi.fn(() => {
      throw callbackError;
    });

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const socket = connectShowtime("showtime123", onMessage);

    socket.trigger("message", {
      data: JSON.stringify({
        type: "SEAT_UPDATE",
      }),
    });

    expect(onMessage).toHaveBeenCalledTimes(1);

    expect(consoleError).toHaveBeenCalledWith(
      "WebSocket error:",
      callbackError
    );
  });
});
