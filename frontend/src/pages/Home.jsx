import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import MovieCard from "../components/MovieCard.jsx";
import "../styles/Home.css";

export default function Home() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");

  const fetchMovies = () => {
    setLoading(true);
    setError("");
    api("/movies")
      .then((data) => {
        setMovies(data || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || "Unable to load movies. Please try again.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMovies();
  }, []);

  // Dynamically extract unique genres from movies
  const genres = useMemo(() => {
    const set = new Set(["All"]);
    movies.forEach((m) => {
      if (Array.isArray(m.genre)) {
        m.genre.forEach((g) => set.add(g));
      } else if (m.genre) {
        m.genre.split(",").forEach((g) => set.add(g.trim()));
      }
    });
    return Array.from(set);
  }, [movies]);

  // Filter movies based on search text & active genre filter
  const filteredMovies = useMemo(() => {
    return movies.filter((movie) => {
      const title = movie.title || "";
      const genreStr = Array.isArray(movie.genre) ? movie.genre.join(" ") : movie.genre || "";
      const matchesSearch =
        title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        genreStr.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesGenre =
        selectedGenre === "All" ||
        (Array.isArray(movie.genre)
          ? movie.genre.includes(selectedGenre)
          : genreStr.includes(selectedGenre));

      return matchesSearch && matchesGenre;
    });
  }, [movies, searchTerm, selectedGenre]);

  // Featured movie (take first movie or fallback)
  const featuredMovie = movies[0] || null;

  return (
    <>
      {/* CINEMATIC HERO SECTION */}
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-content">
            <span className="eyebrow">YOUR NEXT MOVIE NIGHT STARTS HERE</span>
            <h1>More than a movie.<br /><em>Make it a moment.</em></h1>
            <p>
              {featuredMovie?.synopsis ||
                "Discover your next favourite film, choose your seats, and book your cinema experience in minutes across three real-time synchronized halls."}
            </p>

            {featuredMovie && (
              <div className="hero-meta">
                {featuredMovie.genre && (
                  <span>
                    {Array.isArray(featuredMovie.genre) ? featuredMovie.genre.join(" • ") : featuredMovie.genre}
                  </span>
                )}
                {featuredMovie.duration && <span>⏱️ {featuredMovie.duration} min</span>}
              </div>
            )}

            <div>
              <a
                href={featuredMovie ? `#movie-${featuredMovie._id}` : "#movies-catalog"}
                className="button btn-primary"
              >
                {featuredMovie ? `Explore ${featuredMovie.title}` : "Explore Movies"}
              </a>
            </div>
          </div>

          <div className="hero-poster-wrapper">
            <div className="featured-poster-card">
              <div className="featured-poster-img">
                {featuredMovie?.poster ? (
                  <img src={featuredMovie.poster} alt={featuredMovie.title} />
                ) : (
                  <div className="placeholder-poster">
                    <span className="eyebrow">NOW SHOWING</span>
                    <h3>THE BIG SCREEN</h3>
                    <p>FEATURED FILM</p>
                    <strong>Find your next favourite</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MOVIE DISCOVERY SECTION */}
      <section id="movies-catalog">
        <div className="section-heading catalog-header">
          <div>
            <h2>FIND YOUR FILM</h2>
            <p>Great stories deserve the big screen.</p>
          </div>
          <div className="film-count-badge">
            {filteredMovies.length} {filteredMovies.length === 1 ? "FILM" : "FILMS"}
          </div>
        </div>

        {/* Search & Genre Filters */}
        <div className="filter-container">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search movies or genres..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="clear-search-btn">
                Clear
              </button>
            )}
          </div>

          <div className="genre-chips">
            {genres.map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`genre-chip ${selectedGenre === genre ? "active" : ""}`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="state-container error-state">
            <p className="error">{error}</p>
            <button onClick={fetchMovies} className="btn-secondary">
              Try again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="state-container">
            <p>Loading movies...</p>
          </div>
        )}

        {/* Empty Filter State */}
        {!loading && !error && filteredMovies.length === 0 && (
          <div className="state-container">
            <p>No movies match your search or filter criteria.</p>
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedGenre("All");
              }}
              className="btn-secondary"
            >
              Reset filters
            </button>
          </div>
        )}

        {/* Movie Grid */}
        {!loading && !error && filteredMovies.length > 0 && (
          <div className="movie-grid">
            {filteredMovies.map((movie) => (
              <div key={movie._id} id={`movie-${movie._id}`}>
                <MovieCard movie={movie} />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}