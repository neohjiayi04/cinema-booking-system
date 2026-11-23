import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import App from "./App.jsx";

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn()
}));

vi.mock("./context/AuthContext.jsx", () => ({
  useAuth: mockUseAuth
}));

// Mock shared layouts and individual pages.
vi.mock("./components/Navbar.jsx", () => ({
  default: () => <nav>Customer Navbar</nav>
}));

vi.mock("./components/AdminLayout.jsx", async () => {
  const { Outlet } = await import("react-router-dom");

  return {
    default: () => (
      <div>
        <h1>Admin Layout</h1>
        <Outlet />
      </div>
    )
  };
});

vi.mock("./pages/Login.jsx", () => ({
  default: () => <h1>Login Page</h1>
}));

vi.mock("./pages/Register.jsx", () => ({
  default: () => <h1>Register Page</h1>
}));

vi.mock("./pages/customer/Home.jsx", () => ({
  default: () => <h1>Home Page</h1>
}));

vi.mock("./pages/customer/MovieDetails.jsx", () => ({
  default: () => <h1>Movie Details Page</h1>
}));

vi.mock("./pages/customer/SeatBooking.jsx", () => ({
  default: () => <h1>Seat Booking Page</h1>
}));

vi.mock("./pages/customer/BookingConfirmation.jsx", () => ({
  default: () => <h1>Booking Confirmation Page</h1>
}));

vi.mock("./pages/customer/MyBookings.jsx", () => ({
  default: () => <h1>My Bookings Page</h1>
}));

vi.mock("./pages/customer/UserProfile.jsx", () => ({
  default: () => <h1>User Profile Page</h1>
}));

vi.mock("./pages/admin/Dashboard.jsx", () => ({
  default: () => <h1>Admin Dashboard Page</h1>
}));

vi.mock("./pages/admin/Movies.jsx", () => ({
  default: () => <h1>Admin Movies Page</h1>
}));

vi.mock("./pages/admin/Halls.jsx", () => ({
  default: () => <h1>Admin Halls Page</h1>
}));

vi.mock("./pages/admin/Showtimes.jsx", () => ({
  default: () => <h1>Admin Showtimes Page</h1>
}));

vi.mock("./pages/admin/Bookings.jsx", () => ({
  default: () => <h1>Admin Bookings Page</h1>
}));

vi.mock("./pages/admin/Profile.jsx", () => ({
  default: () => <h1>Admin Profile Page</h1>
}));

function LocationDisplay() {
  const location = useLocation();

  return (
    <div data-testid="current-path">
      {location.pathname}
    </div>
  );
}

function renderApp(path = "/", user = null) {
  mockUseAuth.mockReturnValue({ user });

  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationDisplay />
      <App />
    </MemoryRouter>
  );
}

const customer = {
  name: "Test Customer",
  email: "customer@example.com",
  role: "customer"
};

const admin = {
  name: "Test Admin",
  email: "admin@example.com",
  role: "admin"
};

describe("App Routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null });
  });

  // Public routes
  describe("Public routes", () => {
    it("should display the home page", () => {
      renderApp("/");

      expect(
        screen.getByRole("heading", { name: "Home Page" })
      ).toBeInTheDocument();

      expect(screen.getByText("Customer Navbar")).toBeInTheDocument();
    });

    it("should display the login page", () => {
      renderApp("/login");

      expect(
        screen.getByRole("heading", { name: "Login Page" })
      ).toBeInTheDocument();
    });

    it("should display the registration page", () => {
      renderApp("/register");

      expect(
        screen.getByRole("heading", { name: "Register Page" })
      ).toBeInTheDocument();
    });

    it("should display movie details without authentication", () => {
      renderApp("/movies/movie-1");

      expect(
        screen.getByRole("heading", { name: "Movie Details Page" })
      ).toBeInTheDocument();
    });
  });

  // Customer protected routes
  describe("Customer protected routes", () => {
    const protectedRoutes = [
      {
        path: "/booking/showtime-1",
        page: "Seat Booking Page"
      },
      {
        path: "/booking-confirmation/booking-1",
        page: "Booking Confirmation Page"
      },
      {
        path: "/my-bookings",
        page: "My Bookings Page"
      },
      {
        path: "/profile",
        page: "User Profile Page"
      }
    ];

    it.each(protectedRoutes)(
      "should redirect unauthenticated users from $path to login",
      ({ path }) => {
        renderApp(path);

        expect(
          screen.getByRole("heading", { name: "Login Page" })
        ).toBeInTheDocument();

        expect(screen.getByTestId("current-path")).toHaveTextContent(
          "/login"
        );
      }
    );

    it.each(protectedRoutes)(
      "should allow authenticated customers to access $path",
      ({ path, page }) => {
        renderApp(path, customer);

        expect(
          screen.getByRole("heading", { name: page })
        ).toBeInTheDocument();
      }
    );
  });

  // Admin access control
  describe("Admin protected routes", () => {
    const adminRoutes = [
      {
        path: "/admin",
        page: "Admin Dashboard Page"
      },
      {
        path: "/admin/movies",
        page: "Admin Movies Page"
      },
      {
        path: "/admin/halls",
        page: "Admin Halls Page"
      },
      {
        path: "/admin/showtimes",
        page: "Admin Showtimes Page"
      },
      {
        path: "/admin/bookings",
        page: "Admin Bookings Page"
      },
      {
        path: "/admin/profile",
        page: "Admin Profile Page"
      }
    ];

    it.each(adminRoutes)(
      "should allow administrators to access $path",
      ({ path, page }) => {
        renderApp(path, admin);

        expect(
          screen.getByRole("heading", { name: "Admin Layout" })
        ).toBeInTheDocument();

        expect(
          screen.getByRole("heading", { name: page })
        ).toBeInTheDocument();

        expect(
          screen.queryByText("Customer Navbar")
        ).not.toBeInTheDocument();
      }
    );

    it.each(adminRoutes)(
      "should redirect unauthenticated users from $path to login",
      ({ path }) => {
        renderApp(path);

        expect(
          screen.getByRole("heading", { name: "Login Page" })
        ).toBeInTheDocument();

        expect(screen.getByTestId("current-path")).toHaveTextContent(
          "/login"
        );
      }
    );

    it.each(adminRoutes)(
      "should redirect non-admin users from $path to home",
      ({ path }) => {
        renderApp(path, customer);

        expect(
          screen.getByRole("heading", { name: "Home Page" })
        ).toBeInTheDocument();

        expect(screen.getByTestId("current-path")).toHaveTextContent("/");
      }
    );
  });

  // Unknown routes
  describe("Unknown routes", () => {
    it("should redirect unknown URLs to the home page", () => {
      renderApp("/unknown-page");

      expect(
        screen.getByRole("heading", { name: "Home Page" })
      ).toBeInTheDocument();

      expect(screen.getByTestId("current-path")).toHaveTextContent("/");
    });
  });
});
