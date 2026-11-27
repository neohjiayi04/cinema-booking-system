import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home.jsx";

const { mockApi } = vi.hoisted(() => ({
  mockApi: vi.fn()
}));

vi.mock("../../services/api.js", () => ({
  api: mockApi
}));

// The page renders every movie in the grid through <MovieCard />. Use a minimal
// card so these tests cover Home's own behaviour (loading, filtering, tabs)
// instead of MovieCard's markup.
vi.mock("../../components/MovieCard.jsx", async () => {
  const { createElement: h } = await import("react");

  return {
    default: ({ movie }) =>
      h(
        "article",
        { "data-testid": "movie-card" },
        h("img", { src: movie.poster, alt: movie.title }),
        h("h3", null, movie.title)
      )
  };
});

// Movie status is derived from the release / end dates, so build the fixtures
// relative to today. Hard-coded dates would eventually fall in the past and
// silently move movies to another tab.
function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

const nowShowingDates = {
  status: "NOW_SHOWING",
  releaseDate: daysFromNow(-10),
  endDate: daysFromNow(30)
};

const mockMovies = [
  {
    _id: "movie-1",
    title: "Interstellar",
    genre: ["Sci-Fi", "Adventure"],
    duration: 169,
    rating: "PG-13",
    synopsis: "A journey beyond the stars.",
    poster: "https://example.com/interstellar.jpg",
    ...nowShowingDates
  },
  {
    _id: "movie-2",
    title: "The Dark Knight",
    genre: "Action, Drama",
    duration: 152,
    rating: "PG-13",
    synopsis: "A superhero faces his greatest enemy.",
    poster: "https://example.com/dark-knight.jpg",
    ...nowShowingDates
  },
  {
    _id: "movie-3",
    title: "Finding Nemo",
    genre: ["Animation", "Adventure"],
    duration: 100,
    rating: "G",
    synopsis: "A father searches for his son.",
    poster: "https://example.com/nemo.jpg",
    ...nowShowingDates
  }
];

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );
}

// The featured hero repeats one movie's title, poster and synopsis, so queries
// about the movie grid are scoped to the catalog section.
function catalog() {
  return within(document.querySelector("#movies-catalog"));
}

async function waitForCatalog() {
  await screen.findAllByTestId("movie-card");
}

const searchPlaceholder = "Search movies or genres...";

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

    await waitForCatalog();

    expect(
      catalog().getByRole("heading", { name: "Interstellar" })
    ).toBeInTheDocument();
    expect(
      catalog().getByRole("heading", { name: "The Dark Knight" })
    ).toBeInTheDocument();
    expect(
      catalog().getByRole("heading", { name: "Finding Nemo" })
    ).toBeInTheDocument();
  });

  it("should feature the first Now Showing movie in the hero", async () => {
    renderHome();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Interstellar" })
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Book now/ })).toHaveAttribute(
      "href",
      "/movies/movie-1"
    );
  });

  it("should feature the movie an admin marked as featured", async () => {
    mockApi.mockResolvedValue([
      mockMovies[0],
      { ...mockMovies[1], featured: true }
    ]);

    renderHome();

    expect(
      await screen.findByRole("heading", { level: 1, name: "The Dark Knight" })
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Book now/ })).toHaveAttribute(
      "href",
      "/movies/movie-2"
    );
  });

  it("should display the featured movie synopsis", async () => {
    renderHome();

    expect(
      await screen.findByText("A journey beyond the stars.")
    ).toBeInTheDocument();
  });

  it("should display the featured movie poster", async () => {
    renderHome();

    // The hero poster is labelled "<title> poster"; the grid card uses the title
    const heroPoster = await screen.findByRole("img", {
      name: "Interstellar poster"
    });

    expect(heroPoster).toHaveAttribute(
      "src",
      "https://example.com/interstellar.jpg"
    );
  });

  it("should display the featured movie genre, duration and rating", async () => {
    renderHome();

    await screen.findByRole("heading", { level: 1, name: "Interstellar" });

    expect(screen.getByText("Sci-Fi · Adventure")).toBeInTheDocument();
    expect(screen.getByText("169 min")).toBeInTheDocument();
    expect(screen.getByText("PG-13")).toBeInTheDocument();
  });

  it("should display the correct movie count", async () => {
    renderHome();

    expect(await screen.findByText("3 FILMS")).toBeInTheDocument();
  });

  it("should display the available genres from movie data", async () => {
    renderHome();

    await waitForCatalog();

    for (const genre of ["All", "Sci-Fi", "Adventure", "Action", "Drama", "Animation"]) {
      expect(screen.getByRole("button", { name: genre })).toBeInTheDocument();
    }
  });

  it("should search movies by title", async () => {
    renderHome();

    await waitForCatalog();

    fireEvent.change(screen.getByPlaceholderText(searchPlaceholder), {
      target: { value: "Dark Knight" }
    });

    expect(
      catalog().getByRole("heading", { name: "The Dark Knight" })
    ).toBeInTheDocument();
    expect(
      catalog().queryByRole("heading", { name: "Interstellar" })
    ).not.toBeInTheDocument();
    expect(
      catalog().queryByRole("heading", { name: "Finding Nemo" })
    ).not.toBeInTheDocument();

    expect(screen.getByText("1 FILM")).toBeInTheDocument();
  });

  it("should search movies by genre", async () => {
    renderHome();

    await waitForCatalog();

    fireEvent.change(screen.getByPlaceholderText(searchPlaceholder), {
      target: { value: "Animation" }
    });

    expect(
      catalog().getByRole("heading", { name: "Finding Nemo" })
    ).toBeInTheDocument();
    expect(
      catalog().queryByRole("heading", { name: "Interstellar" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("1 FILM")).toBeInTheDocument();
  });

  it("should filter movies by selected genre", async () => {
    renderHome();

    await waitForCatalog();

    fireEvent.click(screen.getByRole("button", { name: "Action" }));

    expect(
      catalog().getByRole("heading", { name: "The Dark Knight" })
    ).toBeInTheDocument();
    expect(
      catalog().queryByRole("heading", { name: "Interstellar" })
    ).not.toBeInTheDocument();
    expect(
      catalog().queryByRole("heading", { name: "Finding Nemo" })
    ).not.toBeInTheDocument();
  });

  it("should combine search and genre filters", async () => {
    renderHome();

    await waitForCatalog();

    // "Adventure" matches Interstellar and Finding Nemo...
    fireEvent.change(screen.getByPlaceholderText(searchPlaceholder), {
      target: { value: "Adventure" }
    });

    expect(screen.getByText("2 FILMS")).toBeInTheDocument();

    // ...and the Sci-Fi chip narrows that down to Interstellar only
    fireEvent.click(screen.getByRole("button", { name: "Sci-Fi" }));

    expect(
      catalog().getByRole("heading", { name: "Interstellar" })
    ).toBeInTheDocument();
    expect(
      catalog().queryByRole("heading", { name: "Finding Nemo" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("1 FILM")).toBeInTheDocument();
  });

  it("should clear the search term when Clear is clicked", async () => {
    renderHome();

    await waitForCatalog();

    const searchInput = screen.getByPlaceholderText(searchPlaceholder);

    fireEvent.change(searchInput, { target: { value: "Dark Knight" } });

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(searchInput).toHaveValue("");
    expect(
      catalog().getByRole("heading", { name: "Interstellar" })
    ).toBeInTheDocument();
    expect(screen.getByText("3 FILMS")).toBeInTheDocument();
  });

  it("should display an empty state when no movies match the filters", async () => {
    renderHome();

    await waitForCatalog();

    fireEvent.change(screen.getByPlaceholderText(searchPlaceholder), {
      target: { value: "Nonexistent Movie" }
    });

    expect(
      screen.getByText("No movies match your search or filter criteria.")
    ).toBeInTheDocument();
    expect(screen.getByText("0 FILMS")).toBeInTheDocument();
  });

  it("should reset search and genre filters", async () => {
    renderHome();

    await waitForCatalog();

    fireEvent.change(screen.getByPlaceholderText(searchPlaceholder), {
      target: { value: "Nonexistent Movie" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));

    expect(await screen.findByText("3 FILMS")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(searchPlaceholder)).toHaveValue("");
    expect(
      catalog().getByRole("heading", { name: "Interstellar" })
    ).toBeInTheDocument();
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

    await waitForCatalog();

    expect(
      catalog().getByRole("heading", { name: "Interstellar" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Network error")).not.toBeInTheDocument();
    expect(mockApi).toHaveBeenCalledTimes(2);
  });

  it("should display the fallback content when no movies are available", async () => {
    mockApi.mockResolvedValueOnce([]);

    renderHome();

    expect(
      await screen.findByText(
        "Discover your next favourite film, choose your seats, and book your cinema experience in minutes."
      )
    ).toBeInTheDocument();

    expect(screen.getByText("THE BIG SCREEN")).toBeInTheDocument();
    expect(screen.getByText("0 FILMS")).toBeInTheDocument();
  });
});

describe("Home Page availability tabs", () => {
  const statusMovies = [
    {
      _id: "m-now",
      title: "Now Movie",
      genre: "Action",
      duration: 100,
      rating: "PG",
      status: "NOW_SHOWING",
      releaseDate: daysFromNow(-10),
      endDate: daysFromNow(30)
    },
    {
      _id: "m-soon",
      title: "Soon Movie",
      genre: "Comedy",
      duration: 100,
      rating: "PG",
      status: "COMING_SOON",
      releaseDate: daysFromNow(20),
      endDate: daysFromNow(60)
    },
    {
      _id: "m-old",
      title: "Old Movie",
      genre: "Drama",
      duration: 100,
      rating: "PG",
      status: "ENDED",
      releaseDate: daysFromNow(-60),
      endDate: daysFromNow(-10)
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.mockResolvedValue(statusMovies);
  });

  it("should show only Now Showing movies by default", async () => {
    renderHome();

    await waitForCatalog();

    expect(catalog().getByText("Now Movie")).toBeInTheDocument();
    expect(catalog().queryByText("Soon Movie")).not.toBeInTheDocument();
    expect(catalog().queryByText("Old Movie")).not.toBeInTheDocument();
  });

  it("should show how many movies are in each tab", async () => {
    renderHome();

    await waitForCatalog();

    for (const name of [/Now Showing/, /Coming Soon/, /Previously Shown/]) {
      expect(screen.getByRole("tab", { name })).toHaveTextContent("1");
    }
  });

  it("should list upcoming movies under Coming Soon", async () => {
    renderHome();

    await waitForCatalog();

    fireEvent.click(screen.getByRole("tab", { name: /Coming Soon/ }));

    expect(catalog().getByText("Soon Movie")).toBeInTheDocument();
    expect(catalog().queryByText("Now Movie")).not.toBeInTheDocument();
    expect(screen.getByText(/Booking opens on each movie/)).toBeInTheDocument();
  });

  it("should move expired movies to Previously Shown", async () => {
    renderHome();

    await waitForCatalog();

    fireEvent.click(screen.getByRole("tab", { name: /Previously Shown/ }));

    expect(catalog().getByText("Old Movie")).toBeInTheDocument();
    expect(catalog().queryByText("Now Movie")).not.toBeInTheDocument();
    expect(
      screen.getByText(/finished their run and can no longer be booked/)
    ).toBeInTheDocument();
  });

  it("should show a friendly message when a tab is empty", async () => {
    mockApi.mockResolvedValue([statusMovies[0]]);

    renderHome();

    await waitForCatalog();

    fireEvent.click(screen.getByRole("tab", { name: /Coming Soon/ }));

    expect(
      screen.getByText("No upcoming movies announced yet.")
    ).toBeInTheDocument();
  });
});