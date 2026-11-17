import { useEffect, useState, useMemo } from "react";
import { api } from "../services/api.js";
import MovieCard from "../components/MovieCard.jsx";
import { MOVIE_STATUS, statusOf } from "../constants/movieOptions.js";
import "../styles/Home.css";

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

  // Featured movie: the first movie that is now showing (or any movie as a fallback)
  const featuredMovie =
    movies.find((m) => statusOf(m) === MOVIE_STATUS.NOW_SHOWING) || movies[0] || null;

  const currentTab = TABS.find((tab) => tab.key === activeTab);

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