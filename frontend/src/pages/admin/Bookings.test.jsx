import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";

const { mockApi } = vi.hoisted(() => ({
  mockApi: vi.fn(),
}));

vi.mock("../../services/api.js", () => ({
  api: mockApi,
}));

import Bookings from "./Bookings.jsx";

const bookings = [
  {
    _id: "booking1",
    bookingReference: "CINEMA123",
    user: { name: "Alice Tan", email: "alice@example.com" },
    movie: { title: "Interstellar" },
    showtime: { date: "2026-11-20", startTime: "19:30" },
    seats: ["A01", "A02"],
    totalAmount: 25,
    status: "CONFIRMED",
  },
  {
    _id: "booking2",
    bookingReference: "CINEMA456",
    user: { name: "Bob Lee", email: "bob@example.com" },
    movie: { title: "Inception" },
    showtime: { date: "2026-11-21", startTime: "21:00" },
    seats: ["B01"],
    totalAmount: 18.5,
    status: "CANCELLED",
  },
];

function renderBookings() {
  return render(<Bookings />);
}

async function waitForBookings() {
  await screen.findByText("CINEMA123");
}

// The movie filter dropdown repeats movie titles, so table assertions
// are scoped to the table to avoid "multiple elements" errors.
function getTable() {
  return within(screen.getByRole("table"));
}

describe("Admin Bookings Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.mockResolvedValue(bookings);
  });

  it("should display the page heading and description", async () => {
    renderBookings();

    await waitForBookings();

    expect(
      screen.getByRole("heading", { name: "Bookings" })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Monitor customer reservations and booking records.")
    ).toBeInTheDocument();
  });

  it("should display the loading state initially", () => {
    mockApi.mockReturnValue(new Promise(() => {}));

    renderBookings();

    expect(screen.getByText("Loading bookings...")).toBeInTheDocument();
    expect(screen.getByText("Loading booking records...")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refreshing..." })
    ).toBeDisabled();
  });

  it("should fetch bookings from the API", async () => {
    renderBookings();

    await waitForBookings();

    expect(mockApi).toHaveBeenCalledWith("/bookings");
    expect(mockApi).toHaveBeenCalledTimes(1);
  });

  it("should display all booking details in the table", async () => {
    renderBookings();

    await waitForBookings();

    const table = getTable();

    expect(table.getByText("CINEMA123")).toBeInTheDocument();
    expect(table.getByText("Alice Tan")).toBeInTheDocument();
    expect(table.getByText("alice@example.com")).toBeInTheDocument();
    expect(table.getByText("Interstellar")).toBeInTheDocument();
    expect(table.getByText("19:30")).toBeInTheDocument();
    expect(table.getByText("A01, A02")).toBeInTheDocument();
    expect(table.getByText("RM 25.00")).toBeInTheDocument();
    expect(table.getByText("CONFIRMED")).toBeInTheDocument();

    expect(table.getByText("CINEMA456")).toBeInTheDocument();
    expect(table.getByText("Bob Lee")).toBeInTheDocument();
    expect(table.getByText("bob@example.com")).toBeInTheDocument();
    expect(table.getByText("Inception")).toBeInTheDocument();
    expect(table.getByText("21:00")).toBeInTheDocument();
    expect(table.getByText("B01")).toBeInTheDocument();
    expect(table.getByText("RM 18.50")).toBeInTheDocument();
    expect(table.getByText("CANCELLED")).toBeInTheDocument();
  });

  it("should display the correct number of bookings shown", async () => {
    renderBookings();

    await waitForBookings();

    expect(screen.getByText("2 of 2 bookings shown")).toBeInTheDocument();
  });

  it("should display the booking count when only one booking exists", async () => {
    mockApi.mockResolvedValue([bookings[0]]);

    renderBookings();

    await waitForBookings();

    expect(screen.getByText("1 of 1 bookings shown")).toBeInTheDocument();
  });

  it("should display an empty state when there are no bookings", async () => {
    mockApi.mockResolvedValue([]);

    renderBookings();

    expect(await screen.findByText("No bookings yet")).toBeInTheDocument();

    expect(
      screen.getByText(
        "Customer reservations will appear here when tickets are booked."
      )
    ).toBeInTheDocument();

    expect(screen.getByText("0 of 0 bookings shown")).toBeInTheDocument();
  });

  it("should display an error message when the API request fails", async () => {
    mockApi.mockRejectedValue(new Error("Unable to load bookings."));

    renderBookings();

    expect(
      await screen.findByRole("heading", {
        name: "Could not load bookings",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Unable to load bookings.")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });

  it("should retry loading bookings when Try again is clicked", async () => {
    mockApi
      .mockRejectedValueOnce(new Error("Server unavailable"))
      .mockResolvedValueOnce(bookings);

    renderBookings();

    expect(
      await screen.findByRole("heading", {
        name: "Could not load bookings",
      })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("CINEMA123")).toBeInTheDocument();
    expect(getTable().getByText("Alice Tan")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(2);
    });
  });

  it("should display fallback values when user or movie information is missing", async () => {
    mockApi.mockResolvedValue([
      {
        _id: "booking3",
        bookingReference: "CINEMA789",
        user: null,
        movie: null,
        seats: [],
        totalAmount: 10,
      },
    ]);

    renderBookings();

    await screen.findByText("CINEMA789");

    const table = getTable();

    expect(table.getByText("Deleted user")).toBeInTheDocument();
    expect(table.getByText("Deleted movie")).toBeInTheDocument();
    expect(table.getByText("RM 10.00")).toBeInTheDocument();
  });
});