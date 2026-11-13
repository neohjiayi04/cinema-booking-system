import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

// Mock authentication context.
const { mockLogout, mockUseAuth } = vi.hoisted(() => ({
  mockLogout: vi.fn(),
  mockUseAuth: vi.fn()
}));

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: mockUseAuth
}));

// Navbar behaviour tests should not depend on desktop/mobile CSS visibility.
vi.mock("../styles/Navbar.css", () => ({}));

import Navbar from "./Navbar.jsx";

function LocationDisplay() {
  const location = useLocation();

  return (
    <p data-testid="current-location">
      {location.pathname}
    </p>
  );
}

function renderNavbar(user = null, initialPath = "/") {
  mockUseAuth.mockReturnValue({
    user,
    logout: mockLogout
  });

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Navbar />

      <Routes>
        <Route path="/" element={<h1>Movies Page</h1>} />
        <Route path="/login" element={<h1>Login Page</h1>} />
        <Route path="/register" element={<h1>Register Page</h1>} />
        <Route path="/my-bookings" element={<h1>My Bookings Page</h1>} />
        <Route path="/profile" element={<h1>Profile Page</h1>} />
        <Route path="/admin" element={<h1>Admin Dashboard</h1>} />
      </Routes>

      <LocationDisplay />
    </MemoryRouter>
  );
}

describe("Navbar Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display the CINEMAX brand", () => {
    renderNavbar();

    expect(screen.getByText("CINEMAX")).toBeInTheDocument();
  });

  it("should display login and registration links for guests", () => {
    renderNavbar();

    expect(screen.getByRole("link", { name: "Log In" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign Up" })).toBeInTheDocument();
  });

  it("should display the Movies navigation link for guests", () => {
    renderNavbar();

    expect(screen.getByRole("link", { name: "Movies" })).toBeInTheDocument();
  });

  it("should not display authenticated navigation links for guests", () => {
    renderNavbar();

    expect(screen.queryByRole("link", { name: "My Bookings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My Profile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin Panel" })).not.toBeInTheDocument();
  });

  it("should display customer navigation links for logged-in users", () => {
    renderNavbar({
      name: "John Doe",
      email: "john@example.com",
      role: "customer"
    });

    expect(screen.getByRole("link", { name: "My Bookings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Profile" })).toBeInTheDocument();
  });

  it("should hide login and registration links for logged-in users", () => {
    renderNavbar({
      name: "John Doe",
      email: "john@example.com",
      role: "customer"
    });

    expect(screen.queryByRole("link", { name: "Log In" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign Up" })).not.toBeInTheDocument();
  });

  it("should display the Admin Panel link for administrators", () => {
    renderNavbar({
      name: "Admin User",
      email: "admin@example.com",
      role: "admin"
    });

    expect(screen.getByRole("link", { name: "Admin Panel" })).toBeInTheDocument();
  });

it("should link the admin brand to the admin dashboard", () => {
  renderNavbar({
    name: "Admin User",
    email: "admin@example.com",
    role: "admin"
  });

  expect(
    screen.getByRole("link", { name: "CINEMAXADMIN" })
  ).toHaveAttribute("href", "/admin");
});

  it("should not display customer navigation links for administrators", () => {
    renderNavbar({
      name: "Admin User",
      email: "admin@example.com",
      role: "admin"
    });

    expect(screen.queryByRole("link", { name: "My Bookings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My Profile" })).not.toBeInTheDocument();
  });

  it("should highlight the active navigation link", () => {
    renderNavbar(null, "/");

    expect(screen.getByRole("link", { name: "Movies" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("should navigate to the registration page when Sign Up is clicked", async () => {
    renderNavbar();

    fireEvent.click(screen.getByRole("link", { name: "Sign Up" }));

    expect(await screen.findByRole("heading", { name: "Register Page" })).toBeInTheDocument();
    expect(screen.getByTestId("current-location")).toHaveTextContent("/register");
  });

  it("should open the mobile navigation menu when the toggle is clicked", () => {
    renderNavbar();

    const toggle = screen.getByRole("button", { name: "Open menu" });

    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );

    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveClass("is-open");
  });

  it("should close the mobile navigation menu when the toggle is clicked again", () => {
    renderNavbar();

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));

    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    expect(screen.getByRole("navigation", { name: "Primary" })).not.toHaveClass("is-open");
  });

  it("should close the mobile menu when Escape is pressed", () => {
    renderNavbar();

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    expect(screen.getByRole("navigation", { name: "Primary" })).not.toHaveClass("is-open");
  });

  it("should close the mobile menu when clicking outside the navbar", () => {
    renderNavbar();

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    fireEvent.pointerDown(document.body);

    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    expect(screen.getByRole("navigation", { name: "Primary" })).not.toHaveClass("is-open");
  });

  it("should close the mobile menu when the navigation route changes", async () => {
    renderNavbar({
      name: "John Doe",
      email: "john@example.com",
      role: "customer"
    });

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveClass("is-open");

    fireEvent.click(screen.getByRole("link", { name: "My Bookings" }));

    expect(await screen.findByRole("heading", { name: "My Bookings Page" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
        "aria-expanded",
        "false"
      );

      expect(screen.getByRole("navigation", { name: "Primary" })).not.toHaveClass("is-open");
    });
  });

  it("should log out and navigate to the login page", async () => {
    renderNavbar({
      name: "John Doe",
      email: "john@example.com",
      role: "customer"
    });

    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));

    expect(mockLogout).toHaveBeenCalledTimes(1);

    expect(await screen.findByRole("heading", { name: "Login Page" })).toBeInTheDocument();
    expect(screen.getByTestId("current-location")).toHaveTextContent("/login");
  });
});
