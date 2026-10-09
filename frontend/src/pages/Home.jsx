import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import MovieCard from "../components/MovieCard.jsx";

export default function Home() {
  const [movies, setMovies] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/movies").then(setMovies).catch(e => setError(e.message));
  }, []);

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">ONE CINEMA · THREE HALLS · REAL-TIME BOOKING</span>
          <h1>Your movie night,<br /><em>your seat.</em></h1>
          <p>Browse movies, choose a showtime and book your seats while availability stays synchronized across customers in real time.</p>
        </div>
      </section>

      <section>
        <div className="section-heading">
          <div><span className="eyebrow">NOW SHOWING</span><h2>Movies</h2></div>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="movie-grid">
          {movies.map(movie => <MovieCard key={movie._id} movie={movie} />)}
        </div>
      </section>
    </>
  );
}
