import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const { mockLogout, mockUseAuth } = vi.hoisted(() => ({
  mockLogout: vi.fn(),
  mockUseAuth: vi.fn()
}));

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: mockUseAuth
}));

vi.mock("../styles/admin.css", () => ({}));

import AdminLayout from "./AdminLayout.jsx";

function renderAdminLayout(initialPath = "/admin") {
  mockUseAuth.mockReturnValue({
    logout: mockLogout
  });

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<h1>Dashboard Content</h1>} />
          <Route path="movies" element={<h1>Movies Content</h1>} />
          <Route path="halls" element={<h1>Halls Content</h1>} />
          <Route path="showtimes" element={<h1>Showtimes Content</h1>} />
          <Route path="bookings" element={<h1>Bookings Content</h1>} />
          <Route path="profile" element={<h1>Profile Content</h1>} />
        </Route>

        <Route path="/" element={<h1>Customer Home Page</h1>} />
        <Route path="/login" element={<h1>Login Page</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminLayout Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display the CINEMAX admin brand", () => {
    renderAdminLayout();

    expect(
      screen.getByRole("link", { name: "CINEMAXADMIN PANEL" })
    ).toBeInTheDocument();
  });

  it("should display the WORKSPACE navigation label", () => {
    renderAdminLayout();

    expect(screen.getByText("WORKSPACE")).toBeInTheDocument();
  });

  it("should display all six admin navigation links", () => {
    renderAdminLayout();

    const navigation = screen.getByRole("navigation", { name: "Admin" });

    expect(navigation).toHaveTextContent("Dashboard");
    expect(navigation).toHaveTextContent("Movies");
    expect(navigation).toHaveTextContent("Halls");
    expect(navigation).toHaveTextContent("Showtimes");
    expect(navigation).toHaveTextContent("Bookings");
    expect(navigation).toHaveTextContent("Profile");
  });

  it("should navigate to the Movies admin page", async () => {
    renderAdminLayout();

    fireEvent.click(screen.getByRole("link", { name: "Movies" }));

    expect(
      await screen.findByRole("heading", { name: "Movies Content" })
    ).toBeInTheDocument();
  });

  it("should highlight the active navigation link", () => {
    renderAdminLayout("/admin/movies");

    expect(screen.getByRole("link", { name: "Movies" })).toHaveClass("active");
  });

  it("should highlight Dashboard only on the admin dashboard route", () => {
    renderAdminLayout("/admin");

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Movies" })).not.toHaveClass("active");
  });

  it("should display the current date in the top bar", () => {
    renderAdminLayout();

    const today = new Date().toLocaleDateString("en-MY", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    expect(screen.getByText(today)).toBeInTheDocument();
  });

  it("should display the View Site link pointing to the customer homepage", () => {
    renderAdminLayout();

    expect(screen.getByRole("link", { name: "View Site" })).toHaveAttribute(
      "href",
      "/"
    );
  });

  it("should display the Admin role badge", () => {
    renderAdminLayout();

    expect(screen.getByText("Admin", { selector: ".admin-role-badge" })).toBeInTheDocument();
  });

  it("should render nested page content through the Outlet", () => {
    renderAdminLayout("/admin/halls");

    expect(
      screen.getByRole("heading", { name: "Halls Content" })
    ).toBeInTheDocument();
  });

  it("should call logout and navigate to the login page", async () => {
    renderAdminLayout();

    fireEvent.click(screen.getByRole("button", { name: /Log Out/i }));

    expect(mockLogout).toHaveBeenCalledTimes(1);

    expect(
      await screen.findByRole("heading", { name: "Login Page" })
    ).toBeInTheDocument();
  });
});
