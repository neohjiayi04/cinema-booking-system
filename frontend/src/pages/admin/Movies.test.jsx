import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within
} from "@testing-library/react";

const { mockApi } = vi.hoisted(() => ({
  mockApi: vi.fn()
}));

vi.mock("../../services/api.js", () => ({
  api: mockApi
}));

import Movies from "./Movies.jsx";

const sampleMovies = [
  {
    _id: "movie001",
    title: "Interstellar",
    description: "A science fiction adventure through space.",
    genre: "Sci-Fi",
    duration: 169,
    rating: "PG-13",
    poster: "https://example.com/interstellar.jpg",
    releaseDate: "2026-11-20",
    status: "NOW_SHOWING"
  },
  {
    _id: "movie002",
    title: "The Conjuring",
    description: "A supernatural horror film.",
    genre: "Horror",
    duration: 112,
    rating: "18+",
    poster: "",
    releaseDate: "2026-11-21",
    status: "NOW_SHOWING"
  },
  {
    _id: "movie003",
    title: "Inception",
    description: "A thief enters people's dreams.",
    genre: "Sci-Fi",
    duration: 148,
    rating: "PG-13",
    poster: "https://example.com/inception.jpg",
    releaseDate: "2026-11-22",
    status: "NOW_SHOWING"
  }
];

function renderMovies() {
  return render(<Movies />);
}

async function waitForMovies() {
  await screen.findByRole("heading", { name: "Movies" });
  await waitFor(() => {
    expect(mockApi).toHaveBeenCalledWith("/movies");
  });
}

function getMovieRow(title) {
  const titleElement = screen.getByText(title);
  return titleElement.closest(".table-row");
}

describe("Admin Movies Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockApi.mockResolvedValue(sampleMovies);

    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal("scrollTo", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should display the Movies page heading", async () => {
    renderMovies();

    await waitForMovies();

    expect(screen.getByRole("heading", { name: "Movies" })).toBeInTheDocument();
  });

  it("should display the page description", async () => {
    renderMovies();

    await waitForMovies();

    expect(
      screen.getByText("Add new movies to your cinema or browse and manage existing ones.")
    ).toBeInTheDocument();
  });

  it("should fetch movies from the API when the page loads", async () => {
    renderMovies();

    await waitForMovies();

    expect(mockApi).toHaveBeenCalledWith("/movies");
  });

  it("should display the Add New Movie form by default", async () => {
    renderMovies();

    await waitForMovies();

    expect(screen.getByRole("heading", { name: "Add New Movie" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Movie" })).toBeInTheDocument();
  });

  it("should display the View & Manage Movies section", async () => {
    renderMovies();

    await waitForMovies();

    expect(
      screen.getByRole("heading", { name: "View & Manage Movies" })
    ).toBeInTheDocument();
  });

  it("should display the empty state when no movies are available", async () => {
    mockApi.mockResolvedValue([]);

    renderMovies();

    expect(await screen.findByText("No movies found.")).toBeInTheDocument();
  });

  it("should display movies returned by the API", async () => {
    renderMovies();

    await screen.findByText("Interstellar");

    expect(screen.getByText("The Conjuring")).toBeInTheDocument();
    expect(screen.getByText("Inception")).toBeInTheDocument();
  });

  it("should display movie genre, duration and rating", async () => {
    renderMovies();

    await screen.findByText("Interstellar");

    expect(screen.getByText("Sci-Fi • 169 min • PG-13")).toBeInTheDocument();
    expect(screen.getByText("Horror • 112 min • 18+")).toBeInTheDocument();
  });

  it("should display movie poster images when poster URLs exist", async () => {
    renderMovies();

    const poster = await screen.findByRole("img", { name: "Interstellar" });

    expect(poster).toHaveAttribute(
      "src",
      "https://example.com/interstellar.jpg"
    );
  });

  it("should display a placeholder when a movie has no poster", async () => {
    renderMovies();

    await screen.findByText("The Conjuring");

    const row = getMovieRow("The Conjuring");

    expect(
      within(row).getByText("No Img")
    ).toBeInTheDocument();
  });

  it("should filter movies by title using the search field", async () => {
    renderMovies();

    await screen.findByText("Interstellar");

    fireEvent.change(
      screen.getByPlaceholderText("Search by title or description..."),
      { target: { value: "Interstellar" } }
    );

    expect(screen.getByText("Interstellar")).toBeInTheDocument();
    expect(screen.queryByText("The Conjuring")).not.toBeInTheDocument();
    expect(screen.queryByText("Inception")).not.toBeInTheDocument();
  });

  it("should filter movies by description using the search field", async () => {
    renderMovies();

    await screen.findByText("Interstellar");

    fireEvent.change(
      screen.getByPlaceholderText("Search by title or description..."),
      { target: { value: "supernatural" } }
    );

    expect(screen.getByText("The Conjuring")).toBeInTheDocument();
    expect(screen.queryByText("Interstellar")).not.toBeInTheDocument();
  });

  it("should generate genre filter options from the movie list", async () => {
    renderMovies();

    await screen.findByText("Interstellar");

    const genreSelect = screen.getByRole("combobox");

    expect(within(genreSelect).getByRole("option", { name: "All Genres" })).toBeInTheDocument();
    expect(within(genreSelect).getByRole("option", { name: "Sci-Fi" })).toBeInTheDocument();
    expect(within(genreSelect).getByRole("option", { name: "Horror" })).toBeInTheDocument();
  });

  it("should filter movies by selected genre", async () => {
    renderMovies();

    await screen.findByText("Interstellar");

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Horror" }
    });

    expect(screen.getByText("The Conjuring")).toBeInTheDocument();
    expect(screen.queryByText("Interstellar")).not.toBeInTheDocument();
    expect(screen.queryByText("Inception")).not.toBeInTheDocument();
  });

  it("should combine search and genre filters", async () => {
    renderMovies();

    await screen.findByText("Interstellar");

    fireEvent.change(
      screen.getByPlaceholderText("Search by title or description..."),
      { target: { value: "space" } }
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Sci-Fi" }
    });

    expect(screen.getByText("Interstellar")).toBeInTheDocument();
    expect(screen.queryByText("The Conjuring")).not.toBeInTheDocument();
    expect(screen.queryByText("Inception")).not.toBeInTheDocument();
  });

  it("should display a message when search and filters return no results", async () => {
    renderMovies();

    await screen.findByText("Interstellar");

    fireEvent.change(
      screen.getByPlaceholderText("Search by title or description..."),
      { target: { value: "nonexistent movie" } }
    );

    expect(screen.getByText("No movies found.")).toBeInTheDocument();
  });

  it("should create a new movie through the API", async () => {
    renderMovies();

    await waitForMovies();

    fireEvent.change(screen.getByPlaceholderText("Enter movie title"), {
      target: { value: "Avatar" }
    });

    fireEvent.change(screen.getByPlaceholderText("e.g. Action, Drama"), {
      target: { value: "Sci-Fi" }
    });

    fireEvent.submit(screen.getByRole("button", { name: "Add Movie" }).closest("form"));

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith(
        "/movies",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    const createCall = mockApi.mock.calls.find(
      ([url, options]) => url === "/movies" && options?.method === "POST"
    );

    expect(JSON.parse(createCall[1].body)).toMatchObject({
      title: "Avatar",
      genre: "Sci-Fi",
      duration: 120,
      rating: "PG",
      status: "NOW_SHOWING"
    });
  });

  it("should populate the form when editing an existing movie", async () => {
    renderMovies();

    await screen.findByText("Interstellar");

    const row = getMovieRow("Interstellar");

    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));

    expect(
      screen.getByRole("heading", { name: "Edit Movie Details" })
    ).toBeInTheDocument();

    expect(screen.getByPlaceholderText("Enter movie title")).toHaveValue("Interstellar");
    expect(screen.getByPlaceholderText("e.g. Action, Drama")).toHaveValue("Sci-Fi");
    expect(screen.getByPlaceholderText("120")).toHaveValue(169);
    expect(screen.getByPlaceholderText("PG, R, 18+")).toHaveValue("PG-13");
    expect(screen.getByRole("button", { name: "Update Movie" })).toBeInTheDocument();
  });

  it("should display the poster preview when editing a movie with a poster", async () => {
    renderMovies();

    await screen.findByText("Interstellar");

    const row = getMovieRow("Interstellar");

    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));

    expect(
      screen.getByRole("img", { name: "Movie Poster Preview" })
    ).toHaveAttribute("src", "https://example.com/interstellar.jpg");
  });

  it("should update an existing movie through the API", async () => {
    renderMovies();

    await screen.findByText("Interstellar");

    const row = getMovieRow("Interstellar");

    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));

    fireEvent.change(screen.getByPlaceholderText("Enter movie title"), {
      target: { value: "Interstellar Updated" }
    });

    fireEvent.submit(
      screen.getByRole("button", { name: "Update Movie" }).closest("form")
    );

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith(
        "/movies/movie001",
        expect.objectContaining({
          method: "PUT"
        })
      );
    });

    const updateCall = mockApi.mock.calls.find(
      ([url, options]) => url === "/movies/movie001" && options?.method === "PUT"
    );

    expect(JSON.parse(updateCall[1].body).title).toBe("Interstellar Updated");
  });

  it("should cancel editing and reset the form", async () => {
    renderMovies();

    await screen.findByText("Interstellar");

    const row = getMovieRow("Interstellar");

    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("heading", { name: "Add New Movie" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter movie title")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Add Movie" })).toBeInTheDocument();
  });

  it("should delete a movie when deletion is confirmed", async () => {
    renderMovies();

    await screen.findByText("Interstellar");

    const row = getMovieRow("Interstellar");

    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));

    expect(confirm).toHaveBeenCalledWith("Delete this movie?");

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith(
        "/movies/movie001",
        { method: "DELETE" }
      );
    });
  });

  it("should not delete a movie when deletion is cancelled", async () => {
    confirm.mockReturnValue(false);

    renderMovies();

    await screen.findByText("Interstellar");

    const row = getMovieRow("Interstellar");

    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));

    expect(confirm).toHaveBeenCalledWith("Delete this movie?");

    expect(mockApi).not.toHaveBeenCalledWith(
      "/movies/movie001",
      { method: "DELETE" }
    );
  });
});
