import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api.js";
import MovieCard from "../../components/MovieCard.jsx";
import { MOVIE_STATUS, MOVIE_STATUS_LABELS, statusOf } from "../../constants/movieOptions.js";
import "../../styles/Home.css";
import "../../styles/HomeHero.css";

const TABS = [
  { key: MOVIE_STATUS.NOW_SHOWING, label: "Now Showing", empty: "No movies are showing right now." },
  { key: MOVIE_STATUS.COMING_SOON, label: "Coming Soon", empty: "No upcoming movies announced yet." },
  { key: MOVIE_STATUS.ENDED, label: "Previously Shown", empty: "No previously shown movies." }
];

export default function Home() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [activeTab, setActiveTab] = useState(MOVIE_STATUS.NOW_SHOWING);

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
    let isActive = true;

    api("/movies")
      .then((data) => {
        if (!isActive) return;
        setMovies(data || []);
        setLoading(false);
      })
      .catch((e) => {
        if (!isActive) return;
        setError(e.message || "Unable to load movies. Please try again.");
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  // Movies in the active tab (Now Showing / Coming Soon / Previously Shown)
  const tabMovies = useMemo(
    () => movies.filter((m) => statusOf(m) === activeTab),
    [movies, activeTab]
  );

  const tabCounts = useMemo(() => {
    const counts = {};
    TABS.forEach((tab) => {
      counts[tab.key] = movies.filter((m) => statusOf(m) === tab.key).length;
    });
    return counts;
  }, [movies]);

  // Dynamically extract unique genres from the movies in this tab
  const genres = useMemo(() => {
    const set = new Set(["All"]);
    tabMovies.forEach((m) => {
      if (Array.isArray(m.genre)) {
        m.genre.forEach((g) => set.add(g));
      } else if (m.genre) {
        m.genre.split(",").forEach((g) => set.add(g.trim()));
      }
    });
    return Array.from(set);
  }, [tabMovies]);

  // A genre chip from another tab may not exist here, so fall back to "All"
  const activeGenre = genres.includes(selectedGenre) ? selectedGenre : "All";

  // Filter movies based on search text & active genre filter
  const filteredMovies = useMemo(() => {
    return tabMovies.filter((movie) => {
      const title = movie.title || "";
      const genreStr = Array.isArray(movie.genre) ? movie.genre.join(" ") : movie.genre || "";
      const matchesSearch =
        title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        genreStr.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesGenre =
        activeGenre === "All" ||
        (Array.isArray(movie.genre)
          ? movie.genre.includes(activeGenre)
          : genreStr.includes(activeGenre));

      return matchesSearch && matchesGenre;
    });
  }, [tabMovies, searchTerm, activeGenre]);

  // Featured movie: the one an admin ticked "Homepage Featured Movie" for (Now Showing first, then
  // Coming Soon). If none is ticked: the first Now Showing movie, then any movie.
  const featuredPicks = movies.filter((m) => m.featured === true);
  const featuredMovie =
    featuredPicks.find((m) => statusOf(m) === MOVIE_STATUS.NOW_SHOWING) ||
    featuredPicks.find((m) => statusOf(m) === MOVIE_STATUS.COMING_SOON) ||
    movies.find((m) => statusOf(m) === MOVIE_STATUS.NOW_SHOWING) ||
    movies[0] ||
    null;

  const currentTab = TABS.find((tab) => tab.key === activeTab);
  const featuredGenres = Array.isArray(featuredMovie?.genre)
    ? featuredMovie.genre.join(" · ")
    : featuredMovie?.genre || "";

  return (
    <>
      {/* FEATURED MOVIE HERO: the movie title is the headline, the poster is the backdrop */}
      <section
        className="hf"
        style={featuredMovie?.poster ? { "--hf-poster": `url("${String(featuredMovie.poster).replace(/"/g, "%22")}")` } : undefined}
      >
        <div className="hf-inner">
          <div className="hf-copy">
            {featuredMovie ? (
              <>
                <span className="hf-eyebrow">
                  <i aria-hidden="true">★</i> Featured · {MOVIE_STATUS_LABELS[statusOf(featuredMovie)] || "Now Showing"}
                </span>
                <h1 className="hf-title">{featuredMovie.title}</h1>

                <div className="hf-meta">
                  {featuredGenres && <span>{featuredGenres}</span>}
                  {featuredMovie.duration && <span>{featuredMovie.duration} min</span>}
                  {featuredMovie.rating && <span>{featuredMovie.rating}</span>}
                </div>

                <p className="hf-desc">
                  {featuredMovie.description || featuredMovie.synopsis ||
                    "Choose your seats and book your cinema experience in minutes."}
                </p>

                <div className="hf-actions">
                  <Link to={`/movies/${featuredMovie._id}`} className="hf-btn hf-btn-primary">
                    {statusOf(featuredMovie) === MOVIE_STATUS.NOW_SHOWING ? "Book now" : "View details"}
                    <span aria-hidden="true"> →</span>
                  </Link>
                  <a href="#movies-catalog" className="hf-btn hf-btn-ghost">Browse all movies</a>
                </div>
              </>
            ) : (
              <>
                <span className="hf-eyebrow">Your next movie night starts here</span>
                <h1 className="hf-title">More than a movie.<br /><em>Make it a moment.</em></h1>
                <p className="hf-desc">
                  Discover your next favourite film, choose your seats, and book your cinema experience in minutes.
                </p>
                <div className="hf-actions">
                  <a href="#movies-catalog" className="hf-btn hf-btn-primary">Explore movies <span aria-hidden="true">→</span></a>
                </div>
              </>
            )}
          </div>

          <div className="hf-poster-wrap">
            <div className="hf-poster">
              {featuredMovie?.poster ? (
                <img src={featuredMovie.poster} alt={`${featuredMovie.title} poster`} />
              ) : (
                <div className="hf-poster-fallback">
                  <span>THE BIG SCREEN</span>
                  <strong>Find your next favourite</strong>
                </div>
              )}
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

        {/* Availability tabs */}
        <div className="status-tabs" role="tablist" aria-label="Movie availability">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`status-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              <span className="status-tab-count">{tabCounts[tab.key]}</span>
            </button>
          ))}
        </div>

        {activeTab === MOVIE_STATUS.COMING_SOON && (
          <p className="status-tab-note">You can view upcoming movies now. Booking opens on each movie&apos;s start date.</p>
        )}
        {activeTab === MOVIE_STATUS.ENDED && (
          <p className="status-tab-note">These movies have finished their run and can no longer be booked.</p>
        )}

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
                className={`genre-chip ${activeGenre === genre ? "active" : ""}`}
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

        {/* Empty Tab State */}
        {!loading && !error && tabMovies.length === 0 && movies.length > 0 && (
          <div className="state-container">
            <p>{currentTab.empty}</p>
          </div>
        )}

        {/* Empty Filter State */}
        {!loading && !error && (tabMovies.length > 0 || movies.length === 0) && filteredMovies.length === 0 && (
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