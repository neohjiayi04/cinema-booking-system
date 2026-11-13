import { describe,it, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import Register from "./Register";

const mockRegister = vi.fn();

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => ({
    register: mockRegister
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

function renderRegister(initialEntry = "/register") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<h1>Login Page</h1>} />
        <Route path="/home" element={<h1>Home Page</h1>} />
        <Route path="/dashboard" element={<h1>Admin Dashboard</h1>} />
        <Route path="/movies/:id" element={<h1>Movie Details</h1>} />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>
  );
}

describe("Register Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should render the registration form", () => {
    renderRegister();

    expect(
      screen.getByRole("heading", { name: "Create Account" })
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");

    expect(
      screen.getByRole("button", { name: "Register" })
    ).toBeInTheDocument();
  });

  test("should allow users to enter their registration details", async () => {
    const user = userEvent.setup();

    renderRegister();

    await user.type(screen.getByLabelText("Name"), "New Customer");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");

    expect(screen.getByLabelText("Name")).toHaveValue("New Customer");
    expect(screen.getByLabelText("Email")).toHaveValue("new@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("Password123!");
  });

  test("should register a customer successfully and redirect to homepage", async () => {
    const user = userEvent.setup();

    mockRegister.mockResolvedValue({
      role: "customer"
    });

    renderRegister();

    await user.type(screen.getByLabelText("Name"), "New Customer");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");

    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/");
    });

    expect(mockRegister).toHaveBeenCalledWith(
      "New Customer",
      "new@example.com",
      "Password123!"
    );
  });

  test("should redirect an admin to the admin dashboard", async () => {
    const user = userEvent.setup();

    mockRegister.mockResolvedValue({
      role: "admin"
    });

    renderRegister();

    await user.type(screen.getByLabelText("Name"), "Admin User");
    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");

    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/admin");
    });
  });

  test("should redirect to the requested returnTo page after registration", async () => {
    const user = userEvent.setup();

    mockRegister.mockResolvedValue({
      role: "customer"
    });

    renderRegister("/register?returnTo=%2Fmovies%2F123");

    await user.type(screen.getByLabelText("Name"), "New Customer");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");

    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/movies/123"
      );
    });
  });

  test("should display an error when registration fails", async () => {
    const user = userEvent.setup();

    mockRegister.mockRejectedValue(
      new Error("Email already registered")
    );

    renderRegister();

    await user.type(screen.getByLabelText("Name"), "Existing Customer");
    await user.type(screen.getByLabelText("Email"), "existing@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");

    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(
      await screen.findByText("Email already registered")
    ).toBeInTheDocument();
  });

  test("should prevent submission when required fields are empty", async () => {
    const user = userEvent.setup();

    renderRegister();

    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(screen.getByLabelText("Name")).toBeInvalid();
    expect(mockRegister).not.toHaveBeenCalled();
  });


    it("should enforce a minimum password length of eight characters", () => {
    renderRegister();

    const passwordInput = screen.getByLabelText("Password");

    expect(passwordInput).toHaveAttribute("minlength", "8");
    expect(passwordInput).toBeRequired();
    });


  test("should include the returnTo parameter in the login link", () => {
    renderRegister("/register?returnTo=%2Fmovies%2F123");

    expect(
      screen.getByRole("link", { name: "Login" })
    ).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fmovies%2F123"
    );
  });
});
