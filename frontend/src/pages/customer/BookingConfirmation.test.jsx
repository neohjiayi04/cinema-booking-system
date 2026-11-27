import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import BookingConfirmation from "./BookingConfirmation.jsx";

const { mockApi, mockWriteText } = vi.hoisted(() => ({
  mockApi: vi.fn(),
  mockWriteText: vi.fn()
}));

vi.mock("../../services/api.js", () => ({
  api: mockApi
}));

const sampleBooking = {
  _id: "booking-1",
  bookingReference: "CINEMA123",
  seats: ["A01", "A02"],
  totalAmount: 25,
  status: "CONFIRMED"
};

const renderConfirmation = (bookingId = "booking-1") => {
  return render(
    <MemoryRouter initialEntries={[`/booking/${bookingId}`]}>
      <Routes>
        <Route
          path="/booking/:id"
          element={<BookingConfirmation />}
        />
        <Route
          path="/my-bookings"
          element={<h1>My Bookings Page</h1>}
        />
      </Routes>
    </MemoryRouter>
  );
};

describe("BookingConfirmation Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockApi.mockResolvedValue(sampleBooking);
    mockWriteText.mockResolvedValue(undefined);

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: mockWriteText
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should display the loading state while fetching booking details", () => {
    mockApi.mockReturnValue(new Promise(() => {}));

    renderConfirmation();

    expect(
      screen.getByText("Loading your ticket...")
    ).toBeInTheDocument();
  });

  it("should fetch booking details using the booking ID", async () => {
    renderConfirmation("booking-123");

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith("/bookings/booking-123");
    });
  });

  it("should display the booking confirmation heading", async () => {
    renderConfirmation();

    expect(
      await screen.findByRole("heading", {
        name: "You are all set!"
      })
    ).toBeInTheDocument();
  });

  it("should display the booking reference", async () => {
    renderConfirmation();

    expect(
      await screen.findByText("CINEMA123")
    ).toBeInTheDocument();

    expect(
      screen.getByText("BOOKING CONFIRMED")
    ).toBeInTheDocument();
  });

  it("should show the movie, date, time and hall when the booking includes them", async () => {
    mockApi.mockResolvedValue({
      ...sampleBooking,
      movie: { title: "Space Voyage" },
      showtime: { date: "2026-12-01", startTime: "19:30" },
      hall: { name: "Hall 2" }
    });

    renderConfirmation();

    expect(await screen.findByText("Space Voyage")).toBeInTheDocument();
    expect(screen.getByText("2026-12-01 · 19:30 · Hall 2")).toBeInTheDocument();
  });

  it("should show an error and a way back when the booking cannot be loaded", async () => {
    mockApi.mockRejectedValue(new Error("Booking not found"));

    renderConfirmation();

    expect(await screen.findByRole("alert")).toHaveTextContent("Booking not found");
    expect(screen.getByRole("link", { name: "View My Bookings" })).toHaveAttribute(
      "href",
      "/my-bookings"
    );
  });

  it("should display the selected seats", async () => {
    renderConfirmation();

    expect(
      await screen.findByText("A01, A02")
    ).toBeInTheDocument();
  });

  it("should display the total booking amount", async () => {
    renderConfirmation();

    expect(
      await screen.findByText("RM 25.00")
    ).toBeInTheDocument();
  });

  it("should display the booking status", async () => {
    renderConfirmation();

    expect(
      await screen.findByText("CONFIRMED")
    ).toBeInTheDocument();
  });

  it("should generate a QR code using the booking reference", async () => {
    renderConfirmation();

    const qrCode = await screen.findByRole("img", {
      name: "Booking QR Code"
    });

    expect(qrCode).toHaveAttribute(
      "src",
      expect.stringContaining(encodeURIComponent("CINEMA123"))
    );
  });

  it("should fall back to the booking reference text when the QR image cannot load", async () => {
    renderConfirmation();

    const qrCode = await screen.findByRole("img", { name: "Booking QR Code" });
    fireEvent.error(qrCode);

    expect(
      await screen.findByText(/QR code unavailable/)
    ).toBeInTheDocument();
    expect(screen.getByText("CINEMA123")).toBeInTheDocument();
  });

  it("should provide a link to the My Bookings page", async () => {
    renderConfirmation();

    const link = await screen.findByRole("link", {
      name: "View My Bookings"
    });

    expect(link).toHaveAttribute("href", "/my-bookings");

    fireEvent.click(link);

    expect(
      await screen.findByRole("heading", {
        name: "My Bookings Page"
      })
    ).toBeInTheDocument();
  });

  it("should copy the booking reference when the copy button is clicked", async () => {
    renderConfirmation();

    const copyButton = await screen.findByTitle("Click to copy");

    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith("CINEMA123");
    });

    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("should reset the copied message after two seconds", async () => {
    renderConfirmation();

    await screen.findByText("CINEMA123");

    vi.useFakeTimers();

    // Clipboard writes are asynchronous, so click inside an async act() to let
    // the "copied" state update flush before asserting.
    await act(async () => {
      fireEvent.click(screen.getByTitle("Click to copy"));
    });

    expect(screen.getByText("Copied!")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.queryByText("Copied!")).not.toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("should not copy a booking reference when no booking is available", () => {
    mockApi.mockReturnValue(new Promise(() => {}));

    renderConfirmation();

    expect(
      screen.getByText("Loading your ticket...")
    ).toBeInTheDocument();

    expect(mockWriteText).not.toHaveBeenCalled();
  });
});