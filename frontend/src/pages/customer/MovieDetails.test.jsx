import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act
} from "@testing-library/react";
import {
  MemoryRouter,
  Routes,
  Route,
  useLocation
} from "react-router-dom";
import MovieDetails from "./MovieDetails.jsx";

const {
  mockApi,
  mockUseAuth,
  mockConnectShowtime,
  mockSocketClose
} = vi.hoisted(() => ({
  mockApi: vi.fn(),
  mockUseAuth: vi.fn(),
  mockConnectShowtime: vi.fn(),
  mockSocketClose: vi.fn()
}));

vi.mock("../../services/api.js", () => ({
  api: mockApi
}));

vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: mockUseAuth
}));

vi.mock("../../services/websocket.js", () => ({
  connectShowtime: mockConnectShowtime
}));

const movie = {
  _id: "movie-1",
  title: "Interstellar",
  genre: ["Sci-Fi", "Adventure"],
  duration: 169,
  rating: "PG-13",
  description: "A journey beyond the stars.",
  poster: "https://example.com/interstellar.jpg"
};

const showtimes = [
  {
    _id: "showtime-1",
    date: "2026-11-20",
    startTime: "19:30",
    price: 12.5,
    hall: { name: "Hall 1" }
  },
  {
    _id: "showtime-2",
    date: "2026-11-21",
    startTime: "21:00",
    price: 15,
    hall: { name: "Hall 2" }
  }
];

const showtimeDetails = {
  _id: "showtime-1",
  date: "2026-11-20",
  startTime: "19:30",
  price: 12.5,
  bookedSeats: ["A03"],
  hall: {
    name: "Hall 1",
    rows: 2,
    seatsPerRow: 3
  }
};

const secondShowtimeDetails = {
  _id: "showtime-2",
  date: "2026-11-21",
  startTime: "21:00",
  price: 15,
  bookedSeats: [],
  hall: {
    name: "Hall 2",
    rows: 2,
    seatsPerRow: 3
  }
};

const PENDING_KEY = "cinemax.pendingBooking";

function LocationDisplay() {
  const location = useLocation();

  return (
    <div data-testid="current-path">
      {location.pathname + location.search}
    </div>
  );
}

function renderMovieDetails(initialEntry = "/movies/movie-1") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationDisplay />

      <Routes>
        <Route path="/movies/:id" element={<MovieDetails />} />
        <Route path="/login" element={<h1>Login Page</h1>} />
        <Route
          path="/booking-confirmation/:bookingId"
          element={<h1>Booking Confirmation Page</h1>}
        />
        <Route path="/" element={<h1>Home Page</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

function setupDefaultApi() {
  mockApi.mockImplementation(async (path) => {
    if (path === "/movies/movie-1") return movie;
    if (path === "/showtimes?movieId=movie-1") return showtimes;
    if (path === "/showtimes/showtime-1") return showtimeDetails;
    if (path === "/showtimes/showtime-2") return secondShowtimeDetails;
    if (path === "/bookings") return { _id: "booking-123" };

    throw new Error(`Unexpected API request: ${path}`);
  });
}

describe("MovieDetails Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    mockUseAuth.mockReturnValue({ user: null });

    mockConnectShowtime.mockReturnValue({
      close: mockSocketClose
    });

    setupDefaultApi();
  });

  it("should display the loading state while fetching movie details", () => {
    mockApi.mockReturnValue(new Promise(() => {}));

    renderMovieDetails();

    expect(
      screen.getByText("Loading movie and showtimes…")
    ).toBeInTheDocument();
  });

  it("should fetch the movie and its showtimes", async () => {
    renderMovieDetails();

    await screen.findByRole("heading", { name: "Interstellar" });

    expect(mockApi).toHaveBeenCalledWith("/movies/movie-1");
    expect(mockApi).toHaveBeenCalledWith("/showtimes?movieId=movie-1");
  });

  it("should display the movie information", async () => {
    renderMovieDetails();

    expect(
      await screen.findByRole("heading", { name: "Interstellar" })
    ).toBeInTheDocument();

    expect(screen.getByText("Sci-Fi · Adventure")).toBeInTheDocument();
    expect(screen.getByText("169 min")).toBeInTheDocument();
    expect(screen.getByText("PG-13")).toBeInTheDocument();
    expect(screen.getByText("A journey beyond the stars.")).toBeInTheDocument();
  });

  it("should display the movie poster", async () => {
    renderMovieDetails();

    const poster = await screen.findByRole("img", {
      name: "Interstellar poster"
    });

    expect(poster).toHaveAttribute(
      "src",
      "https://example.com/interstellar.jpg"
    );
  });

it("should display available showtimes", async () => {
  renderMovieDetails();

  await screen.findByRole("heading", { name: "Interstellar" });

  // Verify both showtime cards.
  expect(screen.getByText("2026-11-20")).toBeInTheDocument();
  expect(screen.getByText("19:30")).toBeInTheDocument();
  expect(screen.getByText("2026-11-21")).toBeInTheDocument();
  expect(screen.getByText("21:00")).toBeInTheDocument();

  // Wait until the selected show's seating details have loaded.
  await screen.findByText("Hall 1 - No seats selected");

  // Hall 1 appears in its showtime card and selected screening.
  expect(screen.getAllByText("Hall 1")).toHaveLength(2);

  expect(screen.getByText("Hall 2")).toBeInTheDocument();

  expect(screen.getByText("RM 12.50")).toBeInTheDocument();
  expect(screen.getByText("RM 15.00")).toBeInTheDocument();
});

  it("should display an empty message when there are no showtimes", async () => {
    mockApi.mockImplementation(async (path) => {
      if (path === "/movies/movie-1") return movie;
      if (path === "/showtimes?movieId=movie-1") return [];
      throw new Error(`Unexpected API request: ${path}`);
    });

    renderMovieDetails();

    expect(
      await screen.findByText(
        "There are no showtimes available for this movie yet."
      )
    ).toBeInTheDocument();
  });

  it("should display an error when movie loading fails", async () => {
    mockApi.mockRejectedValueOnce(new Error("Movie not found"));

    renderMovieDetails();

    expect(await screen.findByText("Movie not found")).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "Back to movies" })
    ).toHaveAttribute("href", "/");
  });

  
it("should display the seating plan after selecting a showtime", async () => {
  renderMovieDetails();

  await screen.findByRole("heading", { name: "Interstellar" });

  expect(
    await screen.findByTitle("Seat A01 - Available")
  ).toBeInTheDocument();

  expect(screen.getAllByText("Hall 1")).toHaveLength(2);
  expect(screen.getByTitle("Seat A03 - Booked")).toBeDisabled();
});


  it("should connect to the selected showtime WebSocket", async () => {
    renderMovieDetails();

    await screen.findByTitle("Seat A01 - Available");

    expect(mockConnectShowtime).toHaveBeenCalledWith(
      "showtime-1",
      expect.any(Function)
    );
  });

  it("should display the live seating status after WebSocket connection", async () => {
    renderMovieDetails();

    await screen.findByTitle("Seat A01 - Available");

    const messageHandler = mockConnectShowtime.mock.calls[0][1];

    act(() => {
      messageHandler({ type: "CONNECTED" });
    });

    expect(
      await screen.findByText("Live seat updates")
    ).toBeInTheDocument();
  });

  it("should update booked seats after a SEAT_BOOKED WebSocket message", async () => {
    renderMovieDetails();

    await screen.findByTitle("Seat A01 - Available");

    const messageHandler = mockConnectShowtime.mock.calls[0][1];

    act(() => {
      messageHandler({
        type: "SEAT_BOOKED",
        seats: ["A01"]
      });
    });

    await waitFor(() => {
      expect(screen.getByTitle("Seat A01 - Booked")).toBeDisabled();
    });
  });

  it("should calculate the total when seats are selected", async () => {
    renderMovieDetails();

    await screen.findByTitle("Seat A01 - Available");

    fireEvent.click(screen.getByTitle("Seat A01 - Available"));
    fireEvent.click(screen.getByTitle("Seat A02 - Available"));

    expect(screen.getByText("RM 25.00")).toBeInTheDocument();
    expect(screen.getByText("Hall 1 - A01, A02")).toBeInTheDocument();
  });

  it("should navigate to login and preserve the selected seats for unauthenticated users", async () => {
    renderMovieDetails();

    await screen.findByTitle("Seat A01 - Available");

    fireEvent.click(screen.getByTitle("Seat A01 - Available"));

    fireEvent.click(
      screen.getByRole("button", { name: "Login to Confirm →" })
    );

    expect(await screen.findByRole("heading", { name: "Login Page" }))
      .toBeInTheDocument();

    const savedBooking = JSON.parse(sessionStorage.getItem(PENDING_KEY));

    expect(savedBooking).toEqual({
      movieId: "movie-1",
      showtimeId: "showtime-1",
      seats: ["A01"]
    });

    expect(screen.getByTestId("current-path").textContent).toBe(
      "/login?returnTo=%2Fmovies%2Fmovie-1%3FresumeBooking%3D1"
    );
  });

  it("should submit a booking for an authenticated user", async () => {
    mockUseAuth.mockReturnValue({
      user: {
        name: "Test Customer",
        email: "customer@example.com",
        role: "customer"
      }
    });

    renderMovieDetails();

    await screen.findByTitle("Seat A01 - Available");

    fireEvent.click(screen.getByTitle("Seat A01 - Available"));

    fireEvent.click(
      screen.getByRole("button", { name: "Confirm Booking →" })
    );

    expect(
      await screen.findByRole("heading", {
        name: "Booking Confirmation Page"
      })
    ).toBeInTheDocument();

    expect(mockApi).toHaveBeenCalledWith("/bookings", {
      method: "POST",
      body: JSON.stringify({
        showtimeId: "showtime-1",
        seats: ["A01"]
      })
    });
  });

  it("should display an error when booking submission fails", async () => {
    mockUseAuth.mockReturnValue({
      user: {
        name: "Test Customer",
        email: "customer@example.com",
        role: "customer"
      }
    });

    mockApi.mockImplementation(async (path) => {
      if (path === "/movies/movie-1") return movie;
      if (path === "/showtimes?movieId=movie-1") return showtimes;
      if (path === "/showtimes/showtime-1") return showtimeDetails;
      if (path === "/bookings") throw new Error("Booking failed");
      throw new Error(`Unexpected API request: ${path}`);
    });

    renderMovieDetails();

    await screen.findByTitle("Seat A01 - Available");

    fireEvent.click(screen.getByTitle("Seat A01 - Available"));

    fireEvent.click(
      screen.getByRole("button", { name: "Confirm Booking →" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Booking failed");

    expect(
      screen.getByRole("button", { name: "Confirm Booking →" })
    ).toBeEnabled();
  });

  it("should switch to another showtime and load its seating plan", async () => {
    renderMovieDetails();

    await screen.findByTitle("Seat A01 - Available");

    fireEvent.click(screen.getByRole("button", { name: /2026-11-21/ }));

    expect(
      await screen.findByTitle("Seat A01 - Available")
    ).toBeInTheDocument();

    expect(mockApi).toHaveBeenCalledWith("/showtimes/showtime-2");
    expect(screen.getByText("RM 0.00")).toBeInTheDocument();
  });

  it("should close the WebSocket connection when the page unmounts", async () => {
    const { unmount } = renderMovieDetails();

    await screen.findByTitle("Seat A01 - Available");

    unmount();

    expect(mockSocketClose).toHaveBeenCalled();
  });


it("should restore a pending seat selection after returning from login", async () => {
  mockUseAuth.mockReturnValue({
    user: {
      name: "Test Customer",
      email: "customer@example.com",
      role: "customer"
    }
  });

  sessionStorage.setItem(
    PENDING_KEY,
    JSON.stringify({
      movieId: "movie-1",
      showtimeId: "showtime-1",
      seats: ["A01"]
    })
  );

  renderMovieDetails("/movies/movie-1");

  expect(
    await screen.findByTitle("Seat A01 - Selected")
  ).toBeInTheDocument();

  expect(screen.getAllByText("RM 12.50")).toHaveLength(2);
});

  it("should automatically submit a saved booking when resuming after login", async () => {
    mockUseAuth.mockReturnValue({
      user: {
        name: "Test Customer",
        email: "customer@example.com",
        role: "customer"
      }
    });

    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        movieId: "movie-1",
        showtimeId: "showtime-1",
        seats: ["A01"]
      })
    );

    renderMovieDetails("/movies/movie-1?resumeBooking=1");

    expect(
      await screen.findByRole("heading", {
        name: "Booking Confirmation Page"
      })
    ).toBeInTheDocument();

    expect(mockApi).toHaveBeenCalledWith("/bookings", {
      method: "POST",
      body: JSON.stringify({
        showtimeId: "showtime-1",
        seats: ["A01"]
      })
    });

    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it.each([
    ["COMING_SOON", "Coming soon", /Booking opens on/],
    ["ENDED", "No longer showing", /can no longer be booked/],
    ["ARCHIVED", "Archived", /no longer available for booking/]
  ])("should not allow booking a %s movie", async (status, heading, message) => {
    mockApi.mockImplementation(async (path) => {
      if (path === "/movies/movie-1") {
        return {
          ...movie,
          status,
          bookable: false,
          releaseDate: "2027-01-10",
          endDate: "2027-02-10"
        };
      }
      if (path === "/showtimes?movieId=movie-1") return showtimes;

      throw new Error(`Unexpected API request: ${path}`);
    });

    renderMovieDetails();

    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();

    // No showtime picker, seat map, or confirm button, and no seat requests.
    expect(screen.queryByText("Choose a showtime")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirm Booking|Login to Confirm/ })).not.toBeInTheDocument();
    expect(mockApi).not.toHaveBeenCalledWith("/showtimes/showtime-1");
    expect(mockConnectShowtime).not.toHaveBeenCalled();
  });

  it("should still allow booking a Now Showing movie that has an end date", async () => {
    mockApi.mockImplementation(async (path) => {
      if (path === "/movies/movie-1") {
        return { ...movie, status: "NOW_SHOWING", bookable: true, releaseDate: "2026-11-01", endDate: "2026-12-31" };
      }
      if (path === "/showtimes?movieId=movie-1") return showtimes;
      if (path === "/showtimes/showtime-1") return showtimeDetails;

      throw new Error(`Unexpected API request: ${path}`);
    });

    renderMovieDetails();

    expect(await screen.findByText("Choose a showtime")).toBeInTheDocument();
    expect(screen.getByText(/Showing until/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Login to Confirm/ })).toBeInTheDocument();
  });
});