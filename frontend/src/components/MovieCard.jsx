import { Link } from "react-router-dom";
import { MOVIE_STATUS, MOVIE_STATUS_LABELS, formatDate } from "../constants/movieOptions.js";

export default function MovieCard({ movie }) {
  const status = movie.status;
  const isEnded = status === MOVIE_STATUS.ENDED;

  return (
    <article className={`card movie-card${isEnded ? " is-ended" : ""}`}>
      <img src={movie.poster || "https://placehold.co/400x600?text=Movie"} alt={movie.title} />
      <div className="card-body">
        <div className="movie-card-tags">
          <span className="badge">{movie.genre}</span>
          {status && (
            <span className={`movie-status-chip status-${status.toLowerCase().replace("_", "-")}`}>
              {MOVIE_STATUS_LABELS[status]}
            </span>
          )}
        </div>
        <h3>{movie.title}</h3>
        <p>{movie.duration} min · {movie.rating}</p>
        {status === MOVIE_STATUS.COMING_SOON && movie.releaseDate && (
          <p className="movie-card-dates">Opens {formatDate(movie.releaseDate)}</p>
        )}
        {isEnded && movie.endDate && (
          <p className="movie-card-dates">Showed until {formatDate(movie.endDate)}</p>
        )}
        <Link className="button" to={`/movies/${movie._id}`}>View Details</Link>
      </div>
    </article>
  );
}
