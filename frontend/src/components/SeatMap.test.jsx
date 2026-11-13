
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SeatMap from "./SeatMap.jsx";

describe("SeatMap Component", () => {
    const defaultProps = {
        rows: 2,
        seatsPerRow: 3,
        bookedSeats: [],
        selectedSeats: [],
        onToggle: vi.fn()
    };

    it("should render the seat map container", () => {
        const { container } = render(<SeatMap {...defaultProps} />);

        expect(container.querySelector(".seat-map-container")).toBeInTheDocument();
    });

    it("should generate the correct number of rows", () => {
        const { container } = render(<SeatMap {...defaultProps} />);

        expect(container.querySelectorAll(".seat-row")).toHaveLength(2);
    });

    it("should generate the correct number of seats", () => {
        const { container } = render(<SeatMap {...defaultProps} />);

        expect(container.querySelectorAll(".seat")).toHaveLength(6);
    });

    it("should generate seat labels using row letters and padded numbers", () => {
        render(<SeatMap {...defaultProps} />);

        expect(screen.getByTitle("Seat A01 - Available")).toBeInTheDocument();
        expect(screen.getByTitle("Seat A02 - Available")).toBeInTheDocument();
        expect(screen.getByTitle("Seat A03 - Available")).toBeInTheDocument();
        expect(screen.getByTitle("Seat B01 - Available")).toBeInTheDocument();
        expect(screen.getByTitle("Seat B02 - Available")).toBeInTheDocument();
        expect(screen.getByTitle("Seat B03 - Available")).toBeInTheDocument();
    });

    it("should display available seats with the correct class", () => {
        render(<SeatMap {...defaultProps} />);

        const seat = screen.getByTitle("Seat A01 - Available");

        expect(seat).toHaveClass("seat", "available");
        expect(seat).toBeEnabled();
    });

    it("should display selected seats with the correct class", () => {
        render(
        <SeatMap
            {...defaultProps}
            selectedSeats={["A01"]}
        />
        );

        const seat = screen.getByTitle("Seat A01 - Selected");

        expect(seat).toHaveClass("seat", "selected");
        expect(seat).toBeEnabled();
    });

    it("should display booked seats with the correct class and disable them", () => {
        render(
        <SeatMap
            {...defaultProps}
            bookedSeats={["A01"]}
        />
        );

        const seat = screen.getByTitle("Seat A01 - Booked");

        expect(seat).toHaveClass("seat", "booked");
        expect(seat).toBeDisabled();
    });

    it("should call onToggle with the correct seat when an available seat is clicked", () => {
        const onToggle = vi.fn();

        render(
        <SeatMap
            {...defaultProps}
            onToggle={onToggle}
        />
        );

        fireEvent.click(screen.getByTitle("Seat A01 - Available"));

        expect(onToggle).toHaveBeenCalledTimes(1);
        expect(onToggle).toHaveBeenCalledWith("A01");
    });

    it("should call onToggle when a selected seat is clicked", () => {
        const onToggle = vi.fn();

        render(
        <SeatMap
            {...defaultProps}
            selectedSeats={["A01"]}
            onToggle={onToggle}
        />
        );

        fireEvent.click(screen.getByTitle("Seat A01 - Selected"));

        expect(onToggle).toHaveBeenCalledWith("A01");
    });

    it("should not call onToggle when a booked seat is clicked", () => {
        const onToggle = vi.fn();

        render(
        <SeatMap
            {...defaultProps}
            bookedSeats={["A01"]}
            onToggle={onToggle}
        />
        );

        fireEvent.click(screen.getByTitle("Seat A01 - Booked"));

        expect(onToggle).not.toHaveBeenCalled();
    });

    it("should display the cinema screen", () => {
        render(<SeatMap {...defaultProps} />);

        expect(screen.getByText("SCREEN")).toBeInTheDocument();
    });

    it("should display all three seat legend categories", () => {
        render(<SeatMap {...defaultProps} />);

        expect(screen.getByText("Available")).toBeInTheDocument();
        expect(screen.getByText("Selected")).toBeInTheDocument();
        expect(screen.getByText("Booked")).toBeInTheDocument();
    });
    });
