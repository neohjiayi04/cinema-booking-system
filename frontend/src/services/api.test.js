import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "./api";

describe("API Service", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("should make a GET request with default JSON headers", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Success" })
    });

    const result = await api("/movies");

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/movies",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    expect(result).toEqual({ message: "Success" });
  });

  test("should include JWT token in Authorization header", async () => {
    localStorage.setItem("token", "test-jwt-token");

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Authenticated" })
    });

    await api("/profile");

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/profile",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-jwt-token"
        }
      })
    );
  });

  test("should support custom request options and headers", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Created" })
    });

    await api("/movies", {
      method: "POST",
      headers: {
        "X-Custom-Header": "test-value"
      },
      body: JSON.stringify({ title: "Test Movie" })
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/movies",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Custom-Header": "test-value"
        },
        body: JSON.stringify({ title: "Test Movie" })
      })
    );
  });

  test("should throw an error when the API returns an unsuccessful response", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ message: "Movie not found" })
    });

    await expect(api("/movies/invalid")).rejects.toThrow(
      "404 Not Found: Movie not found"
    );
  });

  test("should handle unsuccessful responses without a JSON body", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => {
        throw new Error("Invalid JSON");
      }
    });

    await expect(api("/movies")).rejects.toThrow(
      "500 Internal Server Error: Request failed"
    );
  });

  test("should return an empty object when a successful response has no JSON body", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error("Invalid JSON");
      }
    });

    const result = await api("/movies");

    expect(result).toEqual({});
  });
});
