import { describe, it, expect, beforeEach, vi } from "vitest";
import { api } from "./api";

describe("api()", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("sends a GET request with the correct API URL", async () => {
    const mockResponse = {
      message: "Success"
    };
    //global is a Node-only name, so change global to globalThis to make it work in both Node and browser environments
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse)
    });

    const result = await api("/test");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/test"),
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    expect(result).toEqual(mockResponse);
  });

  it("adds the Authorization header when a token exists", async () => {
    localStorage.setItem("token", "test-token");

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true
      })
    });

    await api("/bookings/my");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/bookings/my"),
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token"
        }
      })
    );
  });

  it("does not add Authorization when no token exists", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true
      })
    });

    await api("/movies");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/movies"),
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json"
        }
      })
    );
  });

  it("passes request options to fetch", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true
      })
    });

    await api("/bookings", {
      method: "POST",
      body: JSON.stringify({
        showtimeId: "123",
        seatIds: ["A1"]
      })
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/bookings"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          showtimeId: "123",
          seatIds: ["A1"]
        })
      })
    );
  });

  it("returns parsed JSON when the response is successful", async () => {
    const responseData = {
      id: 1,
      username: "customer",
      bookings: []
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(responseData)
    });

    const result = await api("/bookings/my");

    expect(result).toEqual(responseData);
  });

  it("throws an error using the server message when the request fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: vi.fn().mockResolvedValue({
        message: "Seat is already booked"
      })
    });

    await expect(api("/bookings")).rejects.toMatchObject({
      message: "Seat is already booked",
      status: 409
    });
  });

  it("uses the status code when the server provides no message", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({})
    });

    await expect(api("/test")).rejects.toMatchObject({
      message: "Request failed (500)",
      status: 500
    });
  });

  it("handles a response with invalid JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error("Invalid JSON"))
    });

    await expect(api("/test")).rejects.toMatchObject({
      message: "Request failed (500)",
      status: 500
    });
  });

  it("preserves custom headers from options", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true
      })
    });

    await api("/test", {
      headers: {
        "X-Test-Header": "test-value"
      }
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/test"),
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "X-Test-Header": "test-value"
        }
      })
    );
  });
});