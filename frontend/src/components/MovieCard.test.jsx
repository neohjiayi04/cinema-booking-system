import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MovieCard from "./MovieCard.jsx";

const movie = {
  _id: "movie-123",
  title: "Interstellar",
  genre: "Sci-Fi, Adventure",
  duration: 169,
  rating: "PG-13",
  poster: "https://example.com/interstellar.jpg"
};

function renderMovieCard(movieData = movie) {
  return render(
    <MemoryRouter>
      <MovieCard movie={movieData} />
    </MemoryRouter>
  );
}

describe("MovieCard Component", () => {
  it("should render the movie title", () => {
    renderMovieCard();

    expect(
      screen.getByRole("heading", { name: "Interstellar" })
    ).toBeInTheDocument();
  });

  it("should display the movie genre", () => {
    renderMovieCard();

    expect(screen.getByText("Sci-Fi, Adventure")).toBeInTheDocument();
  });

  it("should display the movie duration and rating", () => {
    renderMovieCard();

    expect(screen.getByText("169 min · PG-13")).toBeInTheDocument();
  });

  it("should display the movie poster with the correct image URL and alt text", () => {
    renderMovieCard();

    const poster = screen.getByRole("img", { name: "Interstellar" });

    expect(poster).toHaveAttribute(
      "src",
      "https://example.com/interstellar.jpg"
    );
    expect(poster).toHaveAttribute("alt", "Interstellar");
  });

  it("should display the fallback poster when no poster is provided", () => {
    renderMovieCard({ ...movie, poster: "" });

    const poster = screen.getByRole("img", { name: "Interstellar" });

    expect(poster).toHaveAttribute(
      "src",
      "https://placehold.co/400x600?text=Movie"
    );
  });

  it("should link to the correct movie details page", () => {
    renderMovieCard();

    expect(
      screen.getByRole("link", { name: "View Details" })
    ).toHaveAttribute("href", "/movies/movie-123");
  });

  it("should render the movie card using the expected CSS classes", () => {
    const { container } = renderMovieCard();

    expect(container.querySelector("article")).toHaveClass(
      "card",
      "movie-card"
    );

    expect(container.querySelector(".card-body")).toBeInTheDocument();
  });
});
