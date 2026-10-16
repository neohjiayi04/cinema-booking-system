import { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api.js";
import "../styles/MovieDetails.css";

export default function MovieDetails() {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [showtimes, setShowtimes] = useState([]);
  const [selectedHall, setSelectedHall] = useState("All");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([api(`/movies/${id}`), api(`/showtimes?movieId=${id}`)])
      .then(([m, s]) => {
        setMovie(m);
        setShowtimes(s || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || "Unable to load movie details.");
        setLoading(false);
      });
  }, [id]);

  const halls = useMemo(() => {
    const hallMap = new Map();
    hallMap.set("All", { _id: "All", name: "All Halls" });

    showtimes.forEach((s) => {
      if (s.hall) {
        const hallKey = s.hall._id || s.hall.name;
        if (!hallMap.has(hallKey)) {
          hallMap.set(hallKey, s.hall);
        }
      }
    });
    return Array.from(hallMap.values());
  }, [showtimes]);

  const filteredShowtimes = useMemo(() => {
    if (selectedHall === "All") return showtimes;
    return showtimes.filter((s) => {
      const hallKey = s.hall?._id || s.hall?.name;
      return hallKey === selectedHall;
    });
  }, [showtimes, selectedHall]);

  if (error) {
    return (
      <div className="movie-detail-container">
        <div className="detail-state-container error-state">
          <p className="error">{error}</p>
        </div>
      </div>
    );
  }

  if (loading || !movie) {
    return (
      <div className="movie-detail-container">
        <div className="detail-state-container">
          <p>Loading cinematic experience...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="movie-detail-container">
      <div className="detail-ambient-glow" />

      {/* HERO SECTION */}
      <section className="detail-hero-section">
        <div className="detail-grid">
          <div className="detail-poster-wrapper">
            <div className="detail-poster-card">
              <img
                className="detail-poster"
                src={movie.poster || "https://placehold.co/400x600?text=Movie"}
                alt={movie.title}
              />
            </div>
          </div>

          <div className="detail-content">
            <span className="badge">
              {Array.isArray(movie.genre) ? movie.genre.join(" • ") : movie.genre}
            </span>
            <h1>{movie.title}</h1>

            <div className="movie-meta-tags">
              <span>⏱️ {movie.duration} min</span>
              <span>⭐ {movie.rating || "PG-13"}</span>
            </div>

            <p className="detail-synopsis">
              {movie.description || movie.synopsis}
            </p>

            <div className="detail-actions">
              <a href="#showtimes-section" className="btn-primary">
                Reserve Seats
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SHOWTIMES SECTION */}
      <section id="showtimes-section" className="showtimes-section-wrap">
        <div className="showtimes-section-header">
          <div>
            <span className="eyebrow">SCREENINGS & TICKETS</span>
            <h2>Showtimes</h2>
            <p>Select your screening slot below</p>
          </div>

          {halls.length > 1 && (
            <div className="hall-filter-chips">
              {halls.map((hall) => {
                const hallKey = hall._id || hall.name;
                const isActive = selectedHall === hallKey;
                return (
                  <button
                    key={hallKey}
                    onClick={() => setSelectedHall(hallKey)}
                    className={`hall-chip ${isActive ? "active" : ""}`}
                  >
                    {hall.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {filteredShowtimes.length > 0 ? (
          <div className="showtime-grid">
            {filteredShowtimes.map((s) => (
              <Link className="showtime-card" key={s._id} to={`/booking/${s._id}`}>
                <div className="showtime-time-info">
                  <span className="showtime-time">{s.startTime}</span>
                  <span className="showtime-date">{s.date}</span>
                </div>
                <div className="showtime-divider" />
                <div className="showtime-venue-info">
                  <span className="hall-badge">{s.hall?.name || "Main Hall"}</span>
                  <span className="showtime-price">RM {s.price}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="no-showtimes">
            <p>No screening slots available for this filter.</p>
          </div>
        )}
      </section>
    </div>
  );
}