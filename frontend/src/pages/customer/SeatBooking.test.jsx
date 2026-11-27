import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within
} from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import SeatBooking from "./SeatBooking.jsx";

const { mockApi, mockConnectShowtime, mockSocketClose } = vi.hoisted(() => ({
  mockApi: vi.fn(),
  mockConnectShowtime: vi.fn(),
  mockSocketClose: vi.fn()
}));

vi.mock("../../services/api.js", () => ({
  api: mockApi
}));

vi.mock("../../services/websocket.js", () => ({
  connectShowtime: mockConnectShowtime
}));

// A simple seat map: one button per seat, titled "Seat A01 - Available" etc.
vi.mock("../../components/SeatMap.jsx", async () => {
  const { createElement: h } = await import("react");

  return {
    default: ({
      rows,
      seatsPerRow,
      bookedSeats = [],
      selectedSeats = [],
      onToggle
    }) => {
      const seats = [];

      for (let row = 0; row < rows; row++) {
        for (let number = 1; number <= seatsPerRow; number++) {
          const id = `${String.fromCharCode(65 + row)}${String(number).padStart(2, "0")}`;
          const booked = bookedSeats.includes(id);
          const selected = selectedSeats.includes(id);

          seats.push(
            h(
              "button",
              {
                key: id,
                type: "button",
                disabled: booked,
                title: `Seat ${id} - ${booked ? "Booked" : selected ? "Selected" : "Available"}`,
                onClick: () => onToggle(id)
              },
              id
            )
          );
        }
      }

      return h("div", null, seats);
    }
  };
});

const mockShowtime = {
  _id: "showtime-123",
  movie: {
    _id: "movie-123",
    title: "Interstellar"
  },
  date: "2026-11-20",
  startTime: "19:30",
  price: 12.5,
  hall: {
    name: "Hall 1",
    rows: 2,
    seatsPerRow: 3
  },
  bookedSeats: ["A03"]
};

function LocationDisplay() {
  const location = useLocation();

  return (
    <div data-testid="current-path">
      {location.pathname}
    </div>
  );
}

function renderSeatBooking() {
  return render(
    <MemoryRouter initialEntries={["/seat-booking/showtime-123"]}>
      <LocationDisplay />

      <Routes>
        <Route
          path="/seat-booking/:id"
          element={<SeatBooking />}
        />

        <Route
          path="/booking-confirmation/:bookingId"
          element={<h1>Booking Confirmation Page</h1>}
        />

        <Route
          path="/"
          element={<h1>Homepage</h1>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("SeatBooking Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockApi.mockResolvedValue(mockShowtime);

    mockConnectShowtime.mockReturnValue({
      close: mockSocketClose
    });
  });

  it("should display the loading state while fetching showtime details", () => {
    mockApi.mockReturnValue(new Promise(() => {}));

    renderSeatBooking();

    expect(
      screen.getByText("Preparing seating arrangements...")
    ).toBeInTheDocument();
  });

  it("should fetch and display showtime details", async () => {
    renderSeatBooking();

    expect(
      await screen.findByRole("heading", { name: "Interstellar" })
    ).toBeInTheDocument();

    expect(screen.getByText("2026-11-20")).toBeInTheDocument();
    expect(screen.getByText("19:30")).toBeInTheDocument();
    expect(screen.getByText("Hall 1")).toBeInTheDocument();

    expect(mockApi).toHaveBeenCalledWith("/showtimes/showtime-123");
  });

  it("should display the connecting status initially", async () => {
    renderSeatBooking();

    await screen.findByRole("heading", { name: "Interstellar" });

    expect(screen.getByText("CONNECTING")).toBeInTheDocument();
  });

  it("should display the error state when showtime loading fails", async () => {
    mockApi.mockRejectedValue(new Error("Showtime not found"));

    renderSeatBooking();

    expect(
      await screen.findByText("Showtime not found")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "Back to Homepage" })
    ).toHaveAttribute("href", "/");
  });

  it("should connect to the correct showtime WebSocket", async () => {
    renderSeatBooking();

    await screen.findByRole("heading", { name: "Interstellar" });

    expect(mockConnectShowtime).toHaveBeenCalledWith(
      "showtime-123",
      expect.any(Function),
      expect.objectContaining({
        onDisconnect: expect.any(Function),
        onReconnect: expect.any(Function),
      })
    );
  });

  it("should update the connection status when the WebSocket connects", async () => {
    renderSeatBooking();

    await screen.findByRole("heading", { name: "Interstellar" });

    const messageHandler = mockConnectShowtime.mock.calls[0][1];

    messageHandler({ type: "CONNECTED" });

    expect(await screen.findByText("LIVE SEATING")).toBeInTheDocument();
  });

  it("should allow users to select available seats and calculate the total price", async () => {
    renderSeatBooking();

    await screen.findByRole("heading", { name: "Interstellar" });

    fireEvent.click(screen.getByTitle("Seat A01 - Available"));
    fireEvent.click(screen.getByTitle("Seat A02 - Available"));

    expect(screen.getByText("2")).toBeInTheDocument();

    // Seat labels also appear on the seat map buttons, so look in the summary
    const summary = document.querySelector(".selected-seats-pills");
    expect(within(summary).getByText("A01")).toBeInTheDocument();
    expect(within(summary).getByText("A02")).toBeInTheDocument();

    expect(screen.getByText("RM 25.00")).toBeInTheDocument();
  });

  it("should allow users to deselect a previously selected seat", async () => {
    renderSeatBooking();

    await screen.findByRole("heading", { name: "Interstellar" });

    fireEvent.click(screen.getByTitle("Seat A01 - Available"));

    expect(screen.getByText("RM 12.50")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Seat A01 - Selected"));

    expect(screen.getByText("RM 0.00")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Tap on available seats to reserve")).toBeInTheDocument();
  });

  it("should display booked seats as unavailable", async () => {
    renderSeatBooking();

    await screen.findByRole("heading", { name: "Interstellar" });

    expect(screen.getByTitle("Seat A03 - Booked")).toBeDisabled();
  });

  it("should update booked seats when receiving a SEAT_BOOKED WebSocket message", async () => {
    renderSeatBooking();

    await screen.findByRole("heading", { name: "Interstellar" });

    fireEvent.click(screen.getByTitle("Seat A01 - Available"));

    const messageHandler = mockConnectShowtime.mock.calls[0][1];

    messageHandler({
      type: "SEAT_BOOKED",
      seats: ["A01", "B01"]
    });

    await waitFor(() => {
      expect(screen.getByTitle("Seat A01 - Booked")).toBeDisabled();
      expect(screen.getByTitle("Seat B01 - Booked")).toBeDisabled();
    });

    expect(screen.getByText("RM 0.00")).toBeInTheDocument();
  });

  it("should keep the confirmation button disabled when no seats are selected", async () => {
    renderSeatBooking();

    await screen.findByRole("heading", { name: "Interstellar" });

    expect(
      screen.getByRole("button", { name: /Confirm Booking/i })
    ).toBeDisabled();
  });

  it("should submit the booking and navigate to the confirmation page", async () => {
    mockApi
      .mockResolvedValueOnce(mockShowtime)
      .mockResolvedValueOnce({ _id: "booking-456" });

    renderSeatBooking();

    await screen.findByRole("heading", { name: "Interstellar" });

    fireEvent.click(screen.getByTitle("Seat A01 - Available"));

    const confirmButton = screen.getByRole("button", {
      name: /Confirm Booking/i
    });

    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);

    expect(
      await screen.findByRole("heading", {
        name: "Booking Confirmation Page"
      })
    ).toBeInTheDocument();

    expect(mockApi).toHaveBeenCalledWith("/bookings", {
      method: "POST",
      body: JSON.stringify({
        showtimeId: "showtime-123",
        seats: ["A01"]
      })
    });
  });

  it("should display an error when booking confirmation fails", async () => {
    mockApi
      .mockResolvedValueOnce(mockShowtime)
      .mockRejectedValueOnce(new Error("Booking failed"));

    renderSeatBooking();

    await screen.findByRole("heading", { name: "Interstellar" });

    fireEvent.click(screen.getByTitle("Seat A01 - Available"));

    fireEvent.click(
      screen.getByRole("button", { name: /Confirm Booking/i })
    );

    expect(
      await screen.findByText("Booking failed")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Confirm Booking/i })
    ).toBeEnabled();
  });

  it("should close the WebSocket connection when the component unmounts", async () => {
    const { unmount } = renderSeatBooking();

    await screen.findByRole("heading", { name: "Interstellar" });

    unmount();

    expect(mockSocketClose).toHaveBeenCalledTimes(1);
  });
});
