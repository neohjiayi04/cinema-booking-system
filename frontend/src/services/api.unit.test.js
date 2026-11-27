import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api.js";

describe("api()", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn();
  });

  it("sends a GET request with the default JSON header", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ movies: [] }),
    });

    const result = await api("/movies");

    expect(result).toEqual({ movies: [] });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/movies",
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  });

  it("adds the JWT Authorization header when a token exists", async () => {
    localStorage.setItem("token", "test-token");

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await api("/profile");

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/profile",
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
      }
    );
  });

  it("does not add Authorization when no token exists", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await api("/health");

    const [, options] = fetch.mock.calls[0];

    expect(options.headers).toEqual({
      "Content-Type": "application/json",
    });
    expect(options.headers.Authorization).toBeUndefined();
  });

  it("preserves custom headers supplied in options", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await api("/movies", {
      headers: {
        "X-Test-Header": "test-value",
      },
    });

    const [, options] = fetch.mock.calls[0];

    expect(options.headers).toEqual({
      "Content-Type": "application/json",
      "X-Test-Header": "test-value",
    });
  });

  it("passes request options such as method and body to fetch", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ created: true }),
    });

    const body = JSON.stringify({ title: "Test Movie" });

    await api("/movies", {
      method: "POST",
      body,
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/movies",
      {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  });

  it("returns parsed JSON data for a successful response", async () => {
    const data = { id: "123", title: "Test Movie" };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => data,
    });

    await expect(api("/movies/123")).resolves.toEqual(data);
  });

  it("returns an empty object when the response body is not valid JSON", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    });

    await expect(api("/health")).resolves.toEqual({});
  });

  it("throws the server message and preserves the HTTP status", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        message: "Seats are already booked",
      }),
    });

    const promise = api("/bookings");

    await expect(promise).rejects.toThrow("Seats are already booked");

    await expect(promise).rejects.toMatchObject({
      status: 409,
    });
  });

  it("falls back to the HTTP status when no server message exists", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const promise = api("/movies");

    await expect(promise).rejects.toThrow("Request failed (500)");

    await expect(promise).rejects.toMatchObject({
      status: 500,
    });
  });

  it("falls back to the HTTP status when the error response is not valid JSON", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    });

    const promise = api("/missing");

    await expect(promise).rejects.toThrow("Request failed (404)");

    await expect(promise).rejects.toMatchObject({
      status: 404,
    });
  });
});