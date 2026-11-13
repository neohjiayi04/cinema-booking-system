import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminDashboard from "./Dashboard.jsx";
import { api } from "../../services/api.js";

vi.mock("../../services/api.js", () => ({
  api: vi.fn(),
}));

const today = new Date();
const todayDate = new Date(
  today.getFullYear(),
  today.getMonth(),
  today.getDate(),
  18,
  0
).toISOString();

const yesterdayDate = new Date(
  today.getFullYear(),
  today.getMonth(),
  today.getDate() - 1,
  18,
  0
).toISOString();

const movies = [
  { _id: "movie001", title: "Movie One" },
  { _id: "movie002", title: "Movie Two" },
  { _id: "movie003", title: "Movie Three" },
];

const bookings = [
  {
    _id: "booking0001",
    user: { name: "Alice" },
    movie: { title: "Movie One" },
    createdAt: todayDate,
    totalAmount: 25,
    status: "confirmed",
  },
  {
    _id: "booking0002",
    user: { name: "Bob" },
    movie: { title: "Movie Two" },
    createdAt: yesterdayDate,
    totalAmount: 30,
    status: "pending",
  },
];

const users = [
  { _id: "user001", name: "Alice" },
  { _id: "user002", name: "Bob" },
];

const showtimes = [
  { _id: "show001", startTime: todayDate },
  { _id: "show002", startTime: todayDate },
  { _id: "show003", startTime: yesterdayDate },
];

function mockDashboardData({
  moviesData = movies,
  bookingsData = bookings,
  usersData = users,
  showtimesData = showtimes,
} = {}) {
  api.mockImplementation((endpoint) => {
    const responses = {
      "/movies": moviesData,
      "/bookings": bookingsData,
      "/users": usersData,
      "/showtimes": showtimesData,
    };

    return Promise.resolve(responses[endpoint]);
  });
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>
  );
}

function getStatValue(label) {
  const statLabel = screen.getByText(label);

  return statLabel
    .closest(".admin-stat-card")
    .querySelector(".admin-stat-value");
}

describe("Admin Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDashboardData();
  });

  it("should display the dashboard heading and description", async () => {
    renderDashboard();

    expect(
      screen.getByRole("heading", { name: "Dashboard" })
    ).toBeInTheDocument();

    expect(
      screen.getByText("A clear overview of your cinema operations.")
    ).toBeInTheDocument();

    await screen.findByText("Alice");
  });

  it("should display navigation links to Movies, Showtimes and Bookings", async () => {
    renderDashboard();

    expect(
      screen.getByRole("link", { name: /Add Movie/i })
    ).toHaveAttribute("href", "/admin/movies");

    expect(
      screen.getByRole("link", { name: /Create Showtime/i })
    ).toHaveAttribute("href", "/admin/showtimes");

    expect(
      screen.getByRole("link", { name: /View All/i })
    ).toHaveAttribute("href", "/admin/bookings");

    await screen.findByText("Alice");
  });

  it("should fetch all four dashboard resources", async () => {
    renderDashboard();

    await screen.findByText("Alice");

    expect(api).toHaveBeenCalledWith("/movies");
    expect(api).toHaveBeenCalledWith("/bookings");
    expect(api).toHaveBeenCalledWith("/users");
    expect(api).toHaveBeenCalledWith("/showtimes");

    expect(api).toHaveBeenCalledTimes(4);
  });

  it("should display loading placeholders while data is being fetched", () => {
    api.mockImplementation(() => new Promise(() => {}));

    renderDashboard();

    expect(screen.getAllByText("…")).toHaveLength(4);
    expect(screen.getByText("Loading bookings…")).toBeInTheDocument();
  });

  it("should display the correct movie, booking and user statistics", async () => {
    renderDashboard();

    await screen.findByText("Alice");

    expect(
      screen.getByText("Movies in catalogue")
    ).toBeInTheDocument();

    expect(
      screen.getByText("All recorded bookings")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Customer and admin accounts")
    ).toBeInTheDocument();

    expect(getStatValue("Total Movies")).toHaveTextContent("3");
    expect(getStatValue("Total Bookings")).toHaveTextContent("2");
    expect(getStatValue("Registered Users")).toHaveTextContent("2");
    });

  it("should display the correct number of shows scheduled today", async () => {
    renderDashboard();

    await screen.findByText("Alice");

   expect(getStatValue("Shows Today")).toHaveTextContent("2");
  });

  it("should display recent booking information", async () => {
    renderDashboard();

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();

    expect(screen.getByText("Movie One")).toBeInTheDocument();
    expect(screen.getByText("Movie Two")).toBeInTheDocument();

    expect(screen.getByText("RM 25.00")).toBeInTheDocument();
    expect(screen.getByText("RM 30.00")).toBeInTheDocument();
  });

  it("should display the shortened booking reference", async () => {
    renderDashboard();

    await screen.findByText("Alice");

    expect(screen.getByText("#king0001")).toBeInTheDocument();
    expect(screen.getByText("#king0002")).toBeInTheDocument();
  });

  it("should display bookings in descending date order", async () => {
    renderDashboard();

    await screen.findByText("Alice");

    const rows = screen.getAllByRole("row");

    expect(rows[1]).toHaveTextContent("Alice");
    expect(rows[2]).toHaveTextContent("Bob");
  });

  it("should display only the five most recent bookings", async () => {
    const manyBookings = Array.from({ length: 7 }, (_, index) => ({
      _id: `booking${String(index + 1).padStart(4, "0")}`,
      user: { name: `Customer ${index + 1}` },
      movie: { title: `Movie ${index + 1}` },
      createdAt: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - index,
        18
      ).toISOString(),
      totalAmount: 20,
      status: "confirmed",
    }));

    mockDashboardData({ bookingsData: manyBookings });

    renderDashboard();

    await screen.findByText("Customer 1");

    expect(screen.getByText("Customer 5")).toBeInTheDocument();
    expect(screen.queryByText("Customer 6")).not.toBeInTheDocument();
    expect(screen.queryByText("Customer 7")).not.toBeInTheDocument();
  });

  it("should display fallback customer and movie names when details are missing", async () => {
    mockDashboardData({
      bookingsData: [
        {
          _id: "booking12345678",
          createdAt: todayDate,
          totalAmount: 10,
          status: "pending",
        },
      ],
    });

    renderDashboard();

    const customerValues = await screen.findAllByText("Customer");

    expect(customerValues).toHaveLength(2);
    expect(customerValues[1]).toBeInTheDocument();

    expect(screen.getByText("Movie booking")).toBeInTheDocument();
  });

  it("should display a partial-load error when one API request fails", async () => {
    api.mockImplementation((endpoint) => {
      if (endpoint === "/users") {
        return Promise.reject(new Error("Request failed"));
      }

      const responses = {
        "/movies": movies,
        "/bookings": bookings,
        "/showtimes": showtimes,
      };

      return Promise.resolve(responses[endpoint]);
    });

    renderDashboard();

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(
      "Some dashboard information could not be loaded."
    );

    expect(await screen.findByText("Alice")).toBeInTheDocument();
  });

  it("should display zero for a resource that fails to load", async () => {
    api.mockImplementation((endpoint) => {
      if (endpoint === "/movies") {
        return Promise.reject(new Error("Movies unavailable"));
      }

      const responses = {
        "/bookings": bookings,
        "/users": users,
        "/showtimes": showtimes,
      };

      return Promise.resolve(responses[endpoint]);
    });

    renderDashboard();

    await screen.findByText("Alice");

    expect(getStatValue("Total Movies")).toHaveTextContent("0");
  });

  it("should support API responses wrapped in a data property", async () => {
    api.mockImplementation((endpoint) => {
      const responses = {
        "/movies": { data: movies },
        "/bookings": { data: bookings },
        "/users": { data: users },
        "/showtimes": { data: showtimes },
      };

      return Promise.resolve(responses[endpoint]);
    });

    renderDashboard();

    await screen.findByText("Alice");

    expect(getStatValue("Total Movies")).toHaveTextContent("3");
  });

  it("should support API responses containing nested data arrays", async () => {
    api.mockImplementation((endpoint) => {
      const responses = {
        "/movies": { data: { data: movies } },
        "/bookings": { data: { data: bookings } },
        "/users": { data: { data: users } },
        "/showtimes": { data: { data: showtimes } },
      };

      return Promise.resolve(responses[endpoint]);
    });

    renderDashboard();

    await screen.findByText("Alice");

    expect(getStatValue("Total Movies")).toHaveTextContent("3");
  });

  it("should support API responses containing items arrays", async () => {
    api.mockImplementation((endpoint) => {
      const responses = {
        "/movies": { items: movies },
        "/bookings": { items: bookings },
        "/users": { items: users },
        "/showtimes": { items: showtimes },
      };

      return Promise.resolve(responses[endpoint]);
    });

    renderDashboard();

    await screen.findByText("Alice");

    expect(getStatValue("Total Movies")).toHaveTextContent("3");
  });

  it("should display an empty state when there are no bookings", async () => {
    mockDashboardData({ bookingsData: [] });

    renderDashboard();

    expect(
      await screen.findByText("No bookings yet")
    ).toBeInTheDocument();

    expect(
      screen.getByText(/New customer bookings will appear here/)
    ).toBeInTheDocument();
  });

  it("should apply the success status style to confirmed bookings", async () => {
    renderDashboard();

    const status = await screen.findByText("Confirmed");

    expect(status).toHaveClass("admin-status");
    expect(status).toHaveClass("admin-status-success");
  });

  it("should apply the warning status style to pending bookings", async () => {
    renderDashboard();

    const status = await screen.findByText("Pending");

    expect(status).toHaveClass("admin-status");
    expect(status).toHaveClass("admin-status-warning");
  });

  it("should apply the danger status style to cancelled bookings", async () => {
    mockDashboardData({
      bookingsData: [
        {
          _id: "bookingcancelled",
          user: { name: "Charlie" },
          movie: { title: "Movie Three" },
          createdAt: todayDate,
          totalAmount: 15,
          status: "cancelled",
        },
      ],
    });

    renderDashboard();

    const status = await screen.findByText("Cancelled");

    expect(status).toHaveClass("admin-status");
    expect(status).toHaveClass("admin-status-danger");
  });
});
