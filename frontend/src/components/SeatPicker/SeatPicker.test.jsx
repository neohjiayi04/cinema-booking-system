import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import SeatPicker from "./SeatPicker";

// jsdom has no WebGL, so the 3D hall is replaced with a stub in tests.
vi.mock("./SeatView3D", () => ({ default: () => <div data-testid="seat-view-3d" /> }));

const seats = [
  { _id: "1", row: "A", number: 1, price: 18, status: "available" },
  { _id: "2", row: "A", number: 2, price: 18, status: "available" },
  { _id: "3", row: "A", number: 3, price: 18, status: "booked" },
  { _id: "4", row: "A", number: 4, price: 18, status: "available" },
];

afterEach(cleanup);

const seat = (n) => screen.getByLabelText(`Row A, seat ${n}`);

describe("SeatPicker", () => {
  it("disables taken seats", () => {
    render(<SeatPicker seats={seats} onConfirm={vi.fn()} />);
    expect(seat(3).disabled).toBe(true);
    expect(seat(1).disabled).toBe(false);
  });

  it("lets you pick several seats and shows the total", () => {
    render(<SeatPicker seats={seats} onConfirm={vi.fn()} />);
    fireEvent.click(seat(1));
    fireEvent.click(seat(2));
    expect(screen.getByTestId("seat-view-3d")).toBeTruthy();
    expect(screen.getByText(/Book 2 seats · RM 36/)).toBeTruthy();
  });

  it("removes a seat when tapped again", () => {
    render(<SeatPicker seats={seats} onConfirm={vi.fn()} />);
    fireEvent.click(seat(1));
    fireEvent.click(seat(1));
    expect(screen.queryByTestId("seat-view-3d")).toBeNull();
  });

  it("enforces the seat limit", () => {
    render(<SeatPicker seats={seats} maxSeats={1} onConfirm={vi.fn()} />);
    fireEvent.click(seat(1));
    fireEvent.click(seat(2));
    expect(screen.getByText(/up to 1 seats/)).toBeTruthy();
  });

  it("sends the chosen seats to onConfirm", async () => {
    const onConfirm = vi.fn().mockResolvedValue();
    render(<SeatPicker seats={seats} onConfirm={onConfirm} />);
    fireEvent.click(seat(1));
    fireEvent.click(seat(2));
    fireEvent.click(screen.getByText(/Book 2 seats/));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm.mock.calls[0][0].map((s) => s.label)).toEqual(["A1", "A2"]);
  });

  it("shows the error when booking fails", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("Seat already booked"));
    render(<SeatPicker seats={seats} onConfirm={onConfirm} />);
    fireEvent.click(seat(1));
    fireEvent.click(screen.getByText(/Book 1 seat/));
    await waitFor(() => expect(screen.getByText("Seat already booked")).toBeTruthy());
  });

  it("drops a selected seat that someone else just took", async () => {
    const { rerender } = render(<SeatPicker seats={seats} onConfirm={vi.fn()} />);
    fireEvent.click(seat(1));
    const updated = seats.map((s) => (s._id === "1" ? { ...s, status: "booked" } : s));
    rerender(<SeatPicker seats={updated} onConfirm={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/just taken/)).toBeTruthy());
    expect(screen.queryByTestId("seat-view-3d")).toBeNull();
  });
});