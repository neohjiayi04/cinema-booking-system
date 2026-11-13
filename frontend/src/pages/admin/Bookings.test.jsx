import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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
    user: { name: "Alice Tan" },
    movie: { title: "Interstellar" },
    seats: ["A01", "A02"],
    totalAmount: 25,
  },
  {
    _id: "booking2",
    bookingReference: "CINEMA456",
    user: { name: "Bob Lee" },
    movie: { title: "Inception" },
    seats: ["B01"],
    totalAmount: 18.5,
  },
];

function renderBookings() {
  return render(<Bookings />);
}

describe("Admin Bookings Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.mockResolvedValue(bookings);
  });

  it("should display the page heading and description", () => {
    renderBookings();

    expect(
      screen.getByRole("heading", { name: "Bookings" })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Manage and view all cinema bookings.")
    ).toBeInTheDocument();
  });

  it("should display the loading state initially", () => {
    mockApi.mockReturnValue(new Promise(() => {}));

    renderBookings();

    expect(screen.getByText("Loading bookings...")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should fetch bookings from the API", async () => {
    renderBookings();

    await screen.findByText("CINEMA123");

    expect(mockApi).toHaveBeenCalledWith("/bookings");
    expect(mockApi).toHaveBeenCalledTimes(1);
  });

  it("should display all booking details in the table", async () => {
    renderBookings();

    await screen.findByText("CINEMA123");

    expect(screen.getByText("Alice Tan")).toBeInTheDocument();
    expect(screen.getByText("Interstellar")).toBeInTheDocument();
    expect(screen.getByText("A01, A02")).toBeInTheDocument();
    expect(screen.getByText("RM 25.00")).toBeInTheDocument();

    expect(screen.getByText("CINEMA456")).toBeInTheDocument();
    expect(screen.getByText("Bob Lee")).toBeInTheDocument();
    expect(screen.getByText("Inception")).toBeInTheDocument();
    expect(screen.getByText("B01")).toBeInTheDocument();
    expect(screen.getByText("RM 18.50")).toBeInTheDocument();
  });

  it("should display the correct number of recorded bookings", async () => {
    renderBookings();

    await screen.findByText("CINEMA123");

    expect(screen.getByText("2 bookings recorded")).toBeInTheDocument();
  });

  it("should display the singular booking count when only one booking exists", async () => {
    mockApi.mockResolvedValue([bookings[0]]);

    renderBookings();

    await screen.findByText("CINEMA123");

    expect(screen.getByText("1 booking recorded")).toBeInTheDocument();
  });

  it("should display an empty state when there are no bookings", async () => {
    mockApi.mockResolvedValue([]);

    renderBookings();

    expect(await screen.findByText("No bookings yet")).toBeInTheDocument();

    expect(
      screen.getByText(
        "When customers book tickets, their reservations will appear here."
      )
    ).toBeInTheDocument();

    expect(screen.getByText("0 bookings recorded")).toBeInTheDocument();
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
    expect(screen.getByText("Alice Tan")).toBeInTheDocument();

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

    expect(screen.getByText("Deleted user")).toBeInTheDocument();
    expect(screen.getByText("Deleted movie")).toBeInTheDocument();
    expect(screen.getByText("RM 10.00")).toBeInTheDocument();
  });
});
