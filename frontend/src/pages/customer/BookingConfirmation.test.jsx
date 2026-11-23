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

    expect(mockWriteText).toHaveBeenCalledWith("CINEMA123");

    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

it("should reset the copied message after two seconds", async () => {
  renderConfirmation();

  await screen.findByText("CINEMA123");

  vi.useFakeTimers();

  fireEvent.click(screen.getByTitle("Click to copy"));

  expect(screen.getByText("Copied!")).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

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
