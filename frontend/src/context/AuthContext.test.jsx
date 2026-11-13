import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./AuthContext";
import { api } from "../services/api.js";

vi.mock("../services/api.js", () => ({
    api: vi.fn()
}));

function TestComponent() {
     const { user, login, register, updateUser, logout } = useAuth();

  return (
    <div>
        <p data-testid="user">
            {user ? `${user.name} (${user.email})` : "Not logged in"}
        </p>

        <button
        onClick={() =>
            login("test@example.com", "password123").catch(() => {})
        }
        >
            Login
        </button>

      <button
        onClick={() =>
          register("New User", "new@example.com", "password123")
        }
      >
            Register
      </button>

      <button
        onClick={() =>
          updateUser({
            id: "user-1",
            name: "Updated User",
            email: "updated@example.com"
          })
        }
      >
        Update User
      </button>

      <button onClick={logout}>Logout</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <TestComponent />
    </AuthProvider>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test("should initialise with no user when localStorage is empty", () => {
    renderAuth();

    expect(screen.getByTestId("user")).toHaveTextContent(
      "Not logged in"
    );
  });

  test("should restore user from localStorage", () => {
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "user-1",
        name: "Test User",
        email: "test@example.com"
      })
    );

    renderAuth();

    expect(screen.getByTestId("user")).toHaveTextContent(
      "Test User (test@example.com)"
    );
  });

  test("should handle invalid user JSON in localStorage", () => {
    localStorage.setItem("user", "invalid-json");

    renderAuth();

    expect(screen.getByTestId("user")).toHaveTextContent(
      "Not logged in"
    );
  });

  test("should login and save token and user to localStorage", async () => {
    const user = userEvent.setup();

    const mockUser = {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "customer"
    };

    api.mockResolvedValue({
      token: "test-jwt-token",
      user: mockUser
    });

    renderAuth();

    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent(
        "Test User (test@example.com)"
      );
    });

    expect(api).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123"
      })
    });

    expect(localStorage.getItem("token")).toBe("test-jwt-token");
    expect(JSON.parse(localStorage.getItem("user"))).toEqual(mockUser);
  });

  test("should register and save token and user to localStorage", async () => {
    const user = userEvent.setup();

    const mockUser = {
      id: "user-2",
      name: "New User",
      email: "new@example.com",
      role: "customer"
    };

    api.mockResolvedValue({
      token: "new-jwt-token",
      user: mockUser
    });

    renderAuth();

    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent(
        "New User (new@example.com)"
      );
    });

    expect(api).toHaveBeenCalledWith("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "New User",
        email: "new@example.com",
        password: "password123"
      })
    });

    expect(localStorage.getItem("token")).toBe("new-jwt-token");
    expect(JSON.parse(localStorage.getItem("user"))).toEqual(mockUser);
  });

  test("should update user information in state and localStorage", async () => {
    const user = userEvent.setup();

    renderAuth();

    await user.click(screen.getByRole("button", { name: "Update User" }));

    expect(screen.getByTestId("user")).toHaveTextContent(
      "Updated User (updated@example.com)"
    );

    expect(JSON.parse(localStorage.getItem("user"))).toEqual({
      id: "user-1",
      name: "Updated User",
      email: "updated@example.com"
    });
  });

  test("should logout and clear authentication data", async () => {
    const user = userEvent.setup();

    localStorage.setItem("token", "test-jwt-token");
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "user-1",
        name: "Test User",
        email: "test@example.com"
      })
    );

    renderAuth();

    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(screen.getByTestId("user")).toHaveTextContent(
      "Not logged in"
    );

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  test("should not save authentication data when login fails", async () => {
    const user = userEvent.setup();

    api.mockRejectedValue(new Error("401 Unauthorized"));

    renderAuth();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Login" }));
    });

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();

    expect(screen.getByTestId("user")).toHaveTextContent(
      "Not logged in"
    );
  });
});
