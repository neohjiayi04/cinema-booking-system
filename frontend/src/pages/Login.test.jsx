import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import Login from "./Login";

const mockLogin = vi.fn();

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => ({
    login: mockLogin
  })
}));

function LocationDisplay() {
  const location = useLocation();

  return (
    <div data-testid="location">
      {location.pathname}{location.search}
    </div>
  );
}

function renderLogin(initialEntry = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/Home" element={<h1>Home Page</h1>} />
        <Route path="/dashboard" element={<h1>Admin Dashboard</h1>} />
        <Route path="/movies/:id" element={<h1>Movie Details</h1>} />
        <Route path="/register" element={<h1>Register Page</h1>} />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>
  );
}

describe("Login Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should render the login form with default credentials", () => {
    renderLogin();

    expect(
      screen.getByRole("heading", { name: "Welcome Back" })
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Email")).toHaveValue(
      "customer@cinema.local"
    );

    expect(screen.getByLabelText("Password")).toHaveValue(
      "Customer123!"
    );

    expect(
      screen.getByRole("button", { name: "Login" })
    ).toBeInTheDocument();
  });

  test("should allow users to change their email and password", async () => {
    const user = userEvent.setup();

    renderLogin();

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");

    await user.clear(emailInput);
    await user.type(emailInput, "new@example.com");

    await user.clear(passwordInput);
    await user.type(passwordInput, "NewPassword123!");

    expect(emailInput).toHaveValue("new@example.com");
    expect(passwordInput).toHaveValue("NewPassword123!");
  });

  test("should login successfully and redirect a customer to the homepage", async () => {
    const user = userEvent.setup();

    mockLogin.mockResolvedValue({
      role: "customer"
    });

    renderLogin();

    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/");
    });

    expect(mockLogin).toHaveBeenCalledWith(
      "customer@cinema.local",
      "Customer123!"
    );
  });

  test("should redirect an admin to the admin dashboard", async () => {
    const user = userEvent.setup();

    mockLogin.mockResolvedValue({
      role: "admin"
    });

    renderLogin();

    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/admin");
    });
  });

  test("should redirect a customer to the requested returnTo page", async () => {
    const user = userEvent.setup();

    mockLogin.mockResolvedValue({
      role: "customer"
    });

    renderLogin("/login?returnTo=%2Fmovies%2F123");

    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/movies/123"
      );
    });
  });

  test("should display an error when login fails", async () => {
    const user = userEvent.setup();

    mockLogin.mockRejectedValue(
      new Error("401 Unauthorized: Invalid credentials")
    );

    renderLogin();

    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(
      await screen.findByText("401 Unauthorized: Invalid credentials")
    ).toBeInTheDocument();
  });

  test("should include the returnTo parameter in the registration link", () => {
    renderLogin("/login?returnTo=%2Fmovies%2F123");

    const registerLink = screen.getByRole("link", {
      name: "Register"
    });

    expect(registerLink).toHaveAttribute(
      "href",
      "/register?returnTo=%2Fmovies%2F123"
    );
  });

  test("should prevent submission when required fields are empty", async () => {
    const user = userEvent.setup();

    renderLogin();

    const emailInput = screen.getByLabelText("Email");

    await user.clear(emailInput);

    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(emailInput).toBeInvalid();
    expect(mockLogin).not.toHaveBeenCalled();
  });
});
