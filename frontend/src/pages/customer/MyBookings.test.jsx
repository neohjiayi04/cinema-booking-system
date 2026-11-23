import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import MyBookings from "./MyBookings.jsx";

const { mockApi } = vi.hoisted(() => ({
  mockApi: vi.fn()
}));

vi.mock("../../services/api.js", () => ({
  api: mockApi
}));

// The page treats a booking as Completed once its showtime has ended, so the fixture
// date is generated relative to today. A fixed date would eventually fall in the past
// and make these tests fail.
const upcomingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

const sampleBooking = {
  _id: "booking-1",
  bookingReference: "CINEMA123",
  movie: {
    title: "Interstellar",
    poster: "https://example.com/interstellar.jpg"
  },
  showtime: {
    date: upcomingDate,
    startTime: "19:30"
  },
  hall: {
    name: "Hall 1"
  },
  seats: ["A01", "A02"],
  totalAmount: 25
};

const renderMyBookings = () => render(<MyBookings />);

describe("MyBookings Page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockApi.mockResolvedValue([sampleBooking]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should fetch the user's bookings when the page loads", async () => {
        renderMyBookings();

        await waitFor(() => {
        expect(mockApi).toHaveBeenCalledWith("/bookings/my");
        });
    });

    it("should display the page heading", async () => {
    renderMyBookings();

    await screen.findByText("Interstellar");

    expect(
        screen.getByRole("heading", {
        name: "My Bookings & Reservations"
        })
    ).toBeInTheDocument();
    });

    it("should display the booking details", async () => {
    renderMyBookings();

    expect(await screen.findByText("Interstellar")).toBeInTheDocument();
    expect(screen.getByText(/CINEMA123/)).toBeInTheDocument();
    expect(screen.getByText(upcomingDate)).toBeInTheDocument();
    expect(screen.getByText("19:30")).toBeInTheDocument();
    expect(screen.getByText("Hall 1")).toBeInTheDocument();
    expect(screen.getByText("A01, A02")).toBeInTheDocument();
    expect(screen.getByText("RM 25.00")).toBeInTheDocument();
    });

    it("should display the movie poster with the correct image source", async () => {
        renderMyBookings();

        const poster = await screen.findByRole("img", {
        name: "Interstellar"
        });

        expect(poster).toHaveAttribute(
        "src",
        "https://example.com/interstellar.jpg"
        );
    });

    it("should display a fallback poster when the movie has no poster", async () => {
        mockApi.mockResolvedValue([
        {
            ...sampleBooking,
            movie: {
            title: "Interstellar",
            poster: null,
            posterUrl: null
            }
        }
        ]);

        renderMyBookings();

        const poster = await screen.findByRole("img", {
        name: "Interstellar"
        });

        expect(poster).toHaveAttribute(
        "src",
        "https://placehold.co/150x220?text=No+Poster"
        );
    });

    it("should generate a QR code using the booking reference", async () => {
        renderMyBookings();

        const qrCode = await screen.findByRole("img", {
        name: "Pass QR Code"
        });

        expect(qrCode).toHaveAttribute(
        "src",
        expect.stringContaining(encodeURIComponent("CINEMA123"))
        );
    });

    it("should display the total number of bookings", async () => {
        renderMyBookings();

        await screen.findByText("Interstellar");

        expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("should display an empty state when there are no bookings", async () => {
        mockApi.mockResolvedValue([]);

        renderMyBookings();

        expect(
        await screen.findByText("You have no upcoming bookings.")
        ).toBeInTheDocument();
    });

    it("should enter seat editing mode when Modify Seats is clicked", async () => {
        renderMyBookings();

        fireEvent.click(
        await screen.findByRole("button", { name: "Modify Seats" })
        );

        expect(screen.getByDisplayValue("A01, A02")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
        expect(
        screen.getByRole("button", { name: "Cancel" })
        ).toBeInTheDocument();
    });

    it("should cancel seat editing without submitting an update", async () => {
        renderMyBookings();

        fireEvent.click(
        await screen.findByRole("button", { name: "Modify Seats" })
        );

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(screen.queryByDisplayValue("A01, A02")).not.toBeInTheDocument();
        expect(mockApi).toHaveBeenCalledTimes(1);
    });

    it("should update the selected seats when Save is clicked", async () => {
        let updatedBooking = sampleBooking;

        mockApi.mockImplementation((url, options) => {
            if (options?.method === "PUT") {
                updatedBooking = {
                    ...sampleBooking,
                    seats: ["B01", "B02"]
                };

                return Promise.resolve(updatedBooking);
            }

            return Promise.resolve([updatedBooking]);
        });

        renderMyBookings();

        fireEvent.click(
            await screen.findByRole("button", { name: "Modify Seats" })
        );

        fireEvent.change(screen.getByDisplayValue("A01, A02"), {
            target: { value: "B01, B02" }
        });

        fireEvent.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() => {
            expect(mockApi).toHaveBeenCalledWith(
                "/bookings/booking-1",
                {
                    method: "PUT",
                    body: JSON.stringify({
                        seats: ["B01", "B02"]
                    })
                }
            );
        });

        expect(await screen.findByText("B01, B02")).toBeInTheDocument();
        expect(screen.queryByDisplayValue("B01, B02")).not.toBeInTheDocument();
    });

    it("should display an alert when updating seats fails", async () => {
        const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

        mockApi.mockImplementation((url, options) => {
        if (options?.method === "PUT") {
            return Promise.reject(new Error("Failed to update seats."));
        }

        return Promise.resolve([sampleBooking]);
        });

        renderMyBookings();

        fireEvent.click(
        await screen.findByRole("button", { name: "Modify Seats" })
        );

        fireEvent.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith("Failed to update seats.");
        });
    });

    it("should cancel a booking when the user confirms cancellation", async () => {
        vi.spyOn(window, "confirm").mockReturnValue(true);

        renderMyBookings();

        fireEvent.click(
        await screen.findByRole("button", { name: "Cancel Pass" })
        );

        await waitFor(() => {
        expect(mockApi).toHaveBeenCalledWith(
            "/bookings/booking-1",
            { method: "DELETE" }
        );
        });

        expect(
        screen.queryByText("Interstellar")
        ).not.toBeInTheDocument();
    });

    it("should not cancel a booking when the user rejects confirmation", async () => {
        vi.spyOn(window, "confirm").mockReturnValue(false);

        renderMyBookings();

        fireEvent.click(
        await screen.findByRole("button", { name: "Cancel Pass" })
        );

        expect(mockApi).toHaveBeenCalledTimes(1);
        expect(mockApi).toHaveBeenCalledWith("/bookings/my");
    });

    it("should display an alert when booking cancellation fails", async () => {
        const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
        vi.spyOn(window, "confirm").mockReturnValue(true);

        mockApi.mockImplementation((url) => {
        if (url === "/bookings/booking-1") {
            return Promise.reject(new Error("Failed to cancel booking."));
        }

        return Promise.resolve([sampleBooking]);
        });

        renderMyBookings();

        fireEvent.click(
        await screen.findByRole("button", { name: "Cancel Pass" })
        );

        await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith("Failed to cancel booking.");
        });
    });
});