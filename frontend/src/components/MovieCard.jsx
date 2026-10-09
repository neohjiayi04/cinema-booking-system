import { Link } from "react-router-dom";

export default function MovieCard({ movie }) {
  return (
    <article className="card movie-card">
      <img src={movie.poster || "https://placehold.co/400x600?text=Movie"} alt={movie.title} />
      <div className="card-body">
        <span className="badge">{movie.genre}</span>
        <h3>{movie.title}</h3>
        <p>{movie.duration} min · {movie.rating}</p>
        <Link className="button" to={`/movies/${movie._id}`}>View Details</Link>
      </div>
    </article>
  );
}
