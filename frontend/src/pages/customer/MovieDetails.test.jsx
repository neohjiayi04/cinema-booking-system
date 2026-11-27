import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
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

// The real 3D hall preview needs WebGL, which jsdom does not provide.
vi.mock("../../components/SeatPicker/SeatPreview3D.jsx", async () => {
  const { createElement: h } = await import("react");

  return {
    default: () => h("div", { "data-testid": "seat-preview-3d" }),
    PreviewSwitch: ({ checked, onChange }) =>
      h(
        "label",
        null,
        h("input", {
          type: "checkbox",
          checked,
          onChange: (event) => onChange(event.target.checked)
        }),
        "3D preview"
      )
  };
});

// The page only offers showtimes that have not started yet, so every date is
// generated relative to today. Fixed dates would eventually fall in the past
// and the page would hide them.
function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

const day1 = daysFromNow(3);
const day2 = daysFromNow(4);
const pastDay = daysFromNow(-3);

const movie = {
  _id: "movie-1",
  title: "Interstellar",
  genre: ["Sci-Fi", "Adventure"],
  duration: 169,
  rating: "PG-13",
  description: "A journey beyond the stars.",
  poster: "https://example.com/interstellar.jpg",
  status: "NOW_SHOWING",
  bookable: true,
  releaseDate: daysFromNow(-10)
};

const showtimes = [
  {
    _id: "showtime-1",
    date: day1,
    startTime: "19:30",
    price: 12.5,
    hall: { name: "Hall 1" }
  },
  {
    _id: "showtime-2",
    date: day2,
    startTime: "21:00",
    price: 15,
    hall: { name: "Hall 2" }
  }
];

const showtimeDetails = {
  _id: "showtime-1",
  date: day1,
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
  date: day2,
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

// Date tabs and time chips are plain buttons inside labelled groups, so find
// them by group instead of by the (formatted) label text.
function getDateTabs() {
  return within(screen.getByLabelText("Choose a date")).getAllByRole("button");
}

function getTimeChips() {
  return within(screen.getByLabelText("Choose a showtime")).getAllByRole("button");
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

    // One tab per date, and the first date's showtimes are shown as chips
    const tabs = getDateTabs();
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute("aria-pressed", "true");
    expect(tabs[1]).toHaveAttribute("aria-pressed", "false");

    let chips = getTimeChips();
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent("19:30");
    expect(chips[0]).toHaveTextContent("Hall 1 · RM 12.50");
    expect(chips[0]).toHaveAttribute("aria-pressed", "true");

    // Wait until the selected showtime's seating details have loaded
    await screen.findByText("Hall 1 - No seats selected");

    // The second date lists its own showtime
    fireEvent.click(tabs[1]);

    chips = getTimeChips();
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent("21:00");
    expect(chips[0]).toHaveTextContent("Hall 2 · RM 15.00");
  });

  it("should hide showtimes that have already started", async () => {
    mockApi.mockImplementation(async (path) => {
      if (path === "/movies/movie-1") return movie;
      if (path === "/showtimes?movieId=movie-1") {
        return [
          {
            _id: "showtime-past",
            date: pastDay,
            startTime: "10:00",
            price: 9,
            hall: { name: "Hall 9" }
          },
          ...showtimes
        ];
      }
      if (path === "/showtimes/showtime-1") return showtimeDetails;

      throw new Error(`Unexpected API request: ${path}`);
    });

    renderMovieDetails();

    await screen.findByText("Hall 1 - No seats selected");

    expect(getDateTabs()).toHaveLength(2);
    expect(screen.queryByText(/Hall 9/)).not.toBeInTheDocument();
    expect(mockApi).not.toHaveBeenCalledWith("/showtimes/showtime-past");
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
        "There are no upcoming showtimes for this movie."
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

  expect(screen.getByText("Hall 1 - No seats selected")).toBeInTheDocument();
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

    // Choose the second date; its first showtime is selected automatically
    fireEvent.click(getDateTabs()[1]);

    expect(
      await screen.findByTitle("Seat A01 - Available")
    ).toBeInTheDocument();

    expect(mockApi).toHaveBeenCalledWith("/showtimes/showtime-2");
    expect(await screen.findByText("Hall 2 - No seats selected")).toBeInTheDocument();
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

  // One selected seat at RM 12.50 (the showtime chip text is "Hall 1 · RM 12.50")
  expect(screen.getByText("RM 12.50")).toBeInTheDocument();
  expect(screen.getByText("Hall 1 - A01")).toBeInTheDocument();
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

  it("should warn when a saved showtime is no longer available after login", async () => {
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        movieId: "movie-1",
        showtimeId: "showtime-gone",
        seats: ["A01"]
      })
    );

    renderMovieDetails("/movies/movie-1?resumeBooking=1");

    const dialog = await screen.findByRole("alertdialog");

    expect(
      within(dialog).getByRole("heading", { name: "Showtime unavailable" })
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/no longer available/);
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Choose another showtime" })
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("should let the customer switch the 3D hall preview off and on", async () => {
    renderMovieDetails();

    await screen.findByTitle("Seat A01 - Available");

    expect(screen.getByTestId("seat-preview-3d")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("3D preview"));

    expect(screen.queryByTestId("seat-preview-3d")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("3D preview"));

    expect(screen.getByTestId("seat-preview-3d")).toBeInTheDocument();
  });

  // The status is derived from the dates, so keep the two consistent
  const datesFor = (status) =>
    status === "COMING_SOON"
      ? { releaseDate: daysFromNow(20), endDate: daysFromNow(60) }
      : status === "ENDED"
        ? { releaseDate: daysFromNow(-60), endDate: daysFromNow(-10) }
        : { releaseDate: daysFromNow(-60), endDate: daysFromNow(-10) };

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
          ...datesFor(status)
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
        return { ...movie, status: "NOW_SHOWING", bookable: true, releaseDate: daysFromNow(-10), endDate: daysFromNow(30) };
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