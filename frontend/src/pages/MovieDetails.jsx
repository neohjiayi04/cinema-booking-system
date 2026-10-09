import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api.js";

export default function MovieDetails() {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [showtimes, setShowtimes] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api(`/movies/${id}`), api(`/showtimes?movieId=${id}`)])
      .then(([m, s]) => { setMovie(m); setShowtimes(s); })
      .catch(e => setError(e.message));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!movie) return <p>Loading...</p>;

  return (
    <section>
      <div className="detail-grid">
        <img className="detail-poster" src={movie.poster} alt={movie.title} />
        <div>
          <span className="badge">{movie.genre}</span>
          <h1>{movie.title}</h1>
          <p>{movie.description}</p>
          <p><strong>{movie.duration} min</strong> · {movie.rating}</p>
        </div>
      </div>

      <h2>Showtimes</h2>
      <div className="showtime-grid">
        {showtimes.map(s => (
          <Link className="showtime" key={s._id} to={`/booking/${s._id}`}>
            <strong>{s.startTime}</strong>
            <span>{s.date}</span>
            <span>{s.hall.name}</span>
            <span>RM {s.price}</span>
          </Link>
        ))}
      </div>
      {!showtimes.length && <p>No showtimes available.</p>}
    </section>
  );
}
