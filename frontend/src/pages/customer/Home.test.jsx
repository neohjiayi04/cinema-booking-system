import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home.jsx";

const { mockApi } = vi.hoisted(() => ({
  mockApi: vi.fn()
}));

vi.mock("../services/api.js", () => ({
  api: mockApi
}));

const mockMovies = [
  {
    _id: "movie-1",
    title: "Interstellar",
    genre: ["Sci-Fi", "Adventure"],
    duration: 169,
    rating: "PG-13",
    synopsis: "A journey beyond the stars.",
    poster: "https://example.com/interstellar.jpg"
  },
  {
    _id: "movie-2",
    title: "The Dark Knight",
    genre: "Action, Drama",
    duration: 152,
    rating: "PG-13",
    synopsis: "A superhero faces his greatest enemy.",
    poster: "https://example.com/dark-knight.jpg"
  },
  {
    _id: "movie-3",
    title: "Finding Nemo",
    genre: ["Animation", "Adventure"],
    duration: 100,
    rating: "G",
    synopsis: "A father searches for his son.",
    poster: "https://example.com/nemo.jpg"
  }
];

function renderHome() {
    return render(
        <MemoryRouter>
        <Home />
        </MemoryRouter>
    );
}

describe("Home Page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockApi.mockResolvedValue(mockMovies);
    });

    it("should display the loading state while fetching movies", () => {
        mockApi.mockReturnValue(new Promise(() => {}));

        renderHome();

        expect(screen.getByText("Loading movies...")).toBeInTheDocument();
    });

    it("should fetch movies from the API", async () => {
        renderHome();

        await waitFor(() => {
        expect(mockApi).toHaveBeenCalledWith("/movies");
        });
    });

    it("should display movies after successful API loading", async () => {
        renderHome();

        expect(
        await screen.findByRole("heading", { name: "Interstellar" })
        ).toBeInTheDocument();

        expect(
        screen.getByRole("heading", { name: "The Dark Knight" })
        ).toBeInTheDocument();

        expect(
        screen.getByRole("heading", { name: "Finding Nemo" })
        ).toBeInTheDocument();
    });

    it("should display the featured movie synopsis", async () => {
        renderHome();

        expect(
        await screen.findByText("A journey beyond the stars.")
        ).toBeInTheDocument();
    });


    it("should display the featured movie poster", async () => {
    renderHome();

    const posters = await screen.findAllByRole("img", {
        name: "Interstellar"
    });

    expect(posters).toHaveLength(2);

    posters.forEach((poster) => {
        expect(poster).toHaveAttribute(
        "src",
        "https://example.com/interstellar.jpg"
        );
    });
    });


    it("should display the featured movie genre and duration", async () => {
        renderHome();

        await screen.findByRole("heading", { name: "Interstellar" });

        expect(screen.getByText("Sci-Fi • Adventure")).toBeInTheDocument();
        expect(screen.getByText("⏱️ 169 min")).toBeInTheDocument();
    });

    it("should display the correct movie count", async () => {
        renderHome();

        expect(await screen.findByText("3 FILMS")).toBeInTheDocument();
    });

    it("should display the available genres from movie data", async () => {
        renderHome();

        await screen.findByRole("heading", { name: "Interstellar" });

        expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Sci-Fi" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Adventure" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Drama" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Animation" })).toBeInTheDocument();
    });

    it("should search movies by title", async () => {
        renderHome();

        await screen.findByRole("heading", { name: "Interstellar" });

        fireEvent.change(
        screen.getByPlaceholderText("Search movies or genres..."),
        { target: { value: "Dark Knight" } }
        );

        expect(
        screen.getByRole("heading", { name: "The Dark Knight" })
        ).toBeInTheDocument();

        expect(screen.queryByRole("heading", { name: "Interstellar" })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Finding Nemo" })).not.toBeInTheDocument();

        expect(screen.getByText("1 FILM")).toBeInTheDocument();
    });

    it("should search movies by genre", async () => {
        renderHome();

        await screen.findByRole("heading", { name: "Interstellar" });

        fireEvent.change(
        screen.getByPlaceholderText("Search movies or genres..."),
        { target: { value: "Animation" } }
        );

        expect(
        screen.getByRole("heading", { name: "Finding Nemo" })
        ).toBeInTheDocument();

        expect(screen.queryByRole("heading", { name: "Interstellar" })).not.toBeInTheDocument();
        expect(screen.getByText("1 FILM")).toBeInTheDocument();
    });

    it("should filter movies by selected genre", async () => {
        renderHome();

        await screen.findByRole("heading", { name: "Interstellar" });

        fireEvent.click(screen.getByRole("button", { name: "Action" }));

        expect(
        screen.getByRole("heading", { name: "The Dark Knight" })
        ).toBeInTheDocument();

        expect(screen.queryByRole("heading", { name: "Interstellar" })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Finding Nemo" })).not.toBeInTheDocument();
    });

    it("should combine search and genre filters", async () => {
        renderHome();

        await screen.findByRole("heading", { name: "Interstellar" });

        fireEvent.change(
        screen.getByPlaceholderText("Search movies or genres..."),
        { target: { value: "Adventure" } }
        );

        fireEvent.click(screen.getByRole("button", { name: "Sci-Fi" }));

        expect(
        screen.getByRole("heading", { name: "Interstellar" })
        ).toBeInTheDocument();

        expect(screen.getByText("1 FILM")).toBeInTheDocument();
    });

    it("should clear the search term when Clear is clicked", async () => {
        renderHome();

        await screen.findByRole("heading", { name: "Interstellar" });

        const searchInput = screen.getByPlaceholderText("Search movies or genres...");

        fireEvent.change(searchInput, {
        target: { value: "Dark Knight" }
        });

        fireEvent.click(screen.getByRole("button", { name: "Clear" }));

        expect(searchInput).toHaveValue("");

        expect(
        screen.getByRole("heading", { name: "Interstellar" })
        ).toBeInTheDocument();

        expect(screen.getByText("3 FILMS")).toBeInTheDocument();
    });

    it("should display an empty state when no movies match the filters", async () => {
        renderHome();

        await screen.findByRole("heading", { name: "Interstellar" });

        fireEvent.change(
        screen.getByPlaceholderText("Search movies or genres..."),
        { target: { value: "Nonexistent Movie" } }
        );

        expect(
        screen.getByText("No movies match your search or filter criteria.")
        ).toBeInTheDocument();

        expect(screen.getByText("0 FILMS")).toBeInTheDocument();
    });

    it("should reset search and genre filters", async () => {
        renderHome();

        await screen.findByRole("heading", { name: "Interstellar" });

        fireEvent.change(
        screen.getByPlaceholderText("Search movies or genres..."),
        { target: { value: "Nonexistent Movie" } }
        );

        fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));

        expect(
        await screen.findByRole("heading", { name: "Interstellar" })
        ).toBeInTheDocument();

        expect(screen.getByText("3 FILMS")).toBeInTheDocument();
    });

    it("should display an error message when movie loading fails", async () => {
        mockApi.mockRejectedValueOnce(new Error("Unable to connect to server"));

        renderHome();

        expect(
        await screen.findByText("Unable to connect to server")
        ).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    });

    it("should retry fetching movies when Try again is clicked", async () => {
        mockApi
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(mockMovies);

        renderHome();

        expect(await screen.findByText("Network error")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Try again" }));

        expect(
        await screen.findByRole("heading", { name: "Interstellar" })
        ).toBeInTheDocument();

        expect(mockApi).toHaveBeenCalledTimes(2);
    });

    it("should display the fallback content when no movies are available", async () => {
        mockApi.mockResolvedValueOnce([]);

        renderHome();

        expect(
        await screen.findByText(
            "Discover your next favourite film, choose your seats, and book your cinema experience in minutes across three real-time synchronized halls."
        )
        ).toBeInTheDocument();

        expect(screen.getByText("THE BIG SCREEN")).toBeInTheDocument();
        expect(screen.getByText("0 FILMS")).toBeInTheDocument();
    });
});

describe("Home Page availability tabs", () => {
  const statusMovies = [
    { _id: "m-now", title: "Now Movie", genre: "Action", duration: 100, rating: "PG", status: "NOW_SHOWING", bookable: true },
    { _id: "m-soon", title: "Soon Movie", genre: "Comedy", duration: 100, rating: "PG", status: "COMING_SOON", bookable: false, releaseDate: "2027-01-10" },
    { _id: "m-old", title: "Old Movie", genre: "Drama", duration: 100, rating: "PG", status: "ENDED", bookable: false, endDate: "2026-10-01" }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.mockResolvedValue(statusMovies);
  });

  it("should show only Now Showing movies by default", async () => {
    renderHome();

    expect(await screen.findByText("Now Movie")).toBeInTheDocument();
    expect(screen.queryByText("Soon Movie")).not.toBeInTheDocument();
    expect(screen.queryByText("Old Movie")).not.toBeInTheDocument();
  });

  it("should list upcoming movies under Coming Soon", async () => {
    renderHome();

    await screen.findByText("Now Movie");

    fireEvent.click(screen.getByRole("tab", { name: /Coming Soon/ }));

    expect(screen.getByText("Soon Movie")).toBeInTheDocument();
    expect(screen.queryByText("Now Movie")).not.toBeInTheDocument();
    expect(screen.getByText(/Booking opens on each movie/)).toBeInTheDocument();
  });

  it("should move expired movies to Previously Shown", async () => {
    renderHome();

    await screen.findByText("Now Movie");

    fireEvent.click(screen.getByRole("tab", { name: /Previously Shown/ }));

    expect(screen.getByText("Old Movie")).toBeInTheDocument();
    expect(screen.queryByText("Now Movie")).not.toBeInTheDocument();
  });

  it("should show a friendly message when a tab is empty", async () => {
    mockApi.mockResolvedValue([statusMovies[0]]);

    renderHome();

    await screen.findByText("Now Movie");

    fireEvent.click(screen.getByRole("tab", { name: /Coming Soon/ }));

    expect(screen.getByText("No upcoming movies announced yet.")).toBeInTheDocument();
  });
});