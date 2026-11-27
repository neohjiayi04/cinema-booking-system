import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SeatMap from "./SeatMap.jsx";

describe("SeatMap", () => {
  const renderSeatMap = (props = {}) => {
    const defaultProps = {
      rows: 2,
      seatsPerRow: 3,
      bookedSeats: [],
      selectedSeats: [],
      onToggle: vi.fn(),
    };

    return render(<SeatMap {...defaultProps} {...props} />);
  };

  it("renders the screen and seat legend", () => {
    renderSeatMap();

    expect(screen.getByText("SCREEN")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("Selected")).toBeInTheDocument();
    expect(screen.getByText("Booked")).toBeInTheDocument();
  });

  it("renders the correct number of seats", () => {
    renderSeatMap();

    const seats = screen.getAllByRole("button");

    expect(seats).toHaveLength(6);
  });

  it("renders seat labels for each row", () => {
    renderSeatMap();

    expect(
      screen.getByTitle("Seat A01 - Available")
    ).toBeInTheDocument();

    expect(
      screen.getByTitle("Seat A02 - Available")
    ).toBeInTheDocument();

    expect(
      screen.getByTitle("Seat A03 - Available")
    ).toBeInTheDocument();

    expect(
      screen.getByTitle("Seat B01 - Available")
    ).toBeInTheDocument();

    expect(
      screen.getByTitle("Seat B02 - Available")
    ).toBeInTheDocument();

    expect(
      screen.getByTitle("Seat B03 - Available")
    ).toBeInTheDocument();
  });

  it("marks an available seat with the available class", () => {
    renderSeatMap();

    const seat = screen.getByTitle("Seat A01 - Available");

    expect(seat).toHaveClass("seat", "available");
    expect(seat).not.toBeDisabled();
  });

  it("marks a selected seat with the selected class", () => {
    renderSeatMap({
      selectedSeats: ["A02"],
    });

    const seat = screen.getByTitle("Seat A02 - Selected");

    expect(seat).toHaveClass("seat", "selected");
    expect(seat).not.toBeDisabled();
  });

  it("marks a booked seat as booked and disables it", () => {
    renderSeatMap({
      bookedSeats: ["A01"],
    });

    const seat = screen.getByTitle("Seat A01 - Booked");

    expect(seat).toHaveClass("seat", "booked");
    expect(seat).toBeDisabled();
  });

  it("calls onToggle with the seat ID when an available seat is clicked", () => {
    const onToggle = vi.fn();

    renderSeatMap({ onToggle });

    fireEvent.click(
      screen.getByTitle("Seat A01 - Available")
    );

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("A01");
  });

  it("calls onToggle with a selected seat when it is clicked", () => {
    const onToggle = vi.fn();

    renderSeatMap({
      selectedSeats: ["B03"],
      onToggle,
    });

    fireEvent.click(
      screen.getByTitle("Seat B03 - Selected")
    );

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("B03");
  });

  it("does not call onToggle when a booked seat is clicked", () => {
    const onToggle = vi.fn();

    renderSeatMap({
      bookedSeats: ["A01"],
      onToggle,
    });

    const seat = screen.getByTitle("Seat A01 - Booked");

    fireEvent.click(seat);

    expect(onToggle).not.toHaveBeenCalled();
  });
});