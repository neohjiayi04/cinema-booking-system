import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import SeatMap from "../components/SeatMap.jsx";
import { api } from "../services/api.js";
import { connectShowtime } from "../services/websocket.js";
import "../styles/MovieDetails.css";

const PENDING_KEY = "cinemax.pendingBooking";

function readPendingBooking() {
  try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null"); }
  catch { return null; }
}

// Wrapper: key={id} remounts the page with fresh state whenever the movie changes,
// so we don't need to reset state manually inside an effect.
export default function MovieDetailsPage() {
  const { id } = useParams();
  return <MovieDetails key={id} movieId={id} />;
}

function MovieDetails({ movieId }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const resumeBooking = searchParams.get("resumeBooking") === "1";

  const [movie, setMovie] = useState(null);
  const [showtimes, setShowtimes] = useState([]);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState("");
  const [showtimeDetails, setShowtimeDetails] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [bookedSeats, setBookedSeats] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seatLoading, setSeatLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resumeReady, setResumeReady] = useState(false);
  const resumedRef = useRef(false);

  // Load movie + showtimes (runs once per mount; remounts when movieId changes)
  useEffect(() => {
    let cancelled = false;
    Promise.all([api(`/movies/${movieId}`), api(`/showtimes?movieId=${movieId}`)])
      .then(([movieData, showtimeData]) => {
        if (cancelled) return;
        setMovie(movieData);
        setShowtimes(showtimeData || []);
        const saved = readPendingBooking();
        const savedShowtime = saved?.movieId === movieId ? saved.showtimeId : "";
        const initialId = savedShowtime || showtimeData?.[0]?._id || "";
        setSelectedShowtimeId(initialId);
        setSeatLoading(Boolean(initialId));
      })
      .catch((e) => !cancelled && setError(e.message || "Unable to load movie details."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [movieId]);

  // Load seats + live updates for the selected showtime.
  // All synchronous resets happen in selectShowtime(), so this effect only does async work.
  useEffect(() => {
    if (!selectedShowtimeId) return undefined;

    let cancelled = false;

    api(`/showtimes/${selectedShowtimeId}`)
      .then((data) => {
        if (cancelled) return;
        setShowtimeDetails(data);
        setBookedSeats(data.bookedSeats || []);
        const saved = readPendingBooking();
        if (saved?.movieId === movieId && saved?.showtimeId === selectedShowtimeId && Array.isArray(saved.seats)) {
          const stillAvailable = saved.seats.filter((seat) => !(data.bookedSeats || []).includes(seat));
          setSelectedSeats(stillAvailable);
          setResumeReady(true);
          if (stillAvailable.length !== saved.seats.length) {
            setError("One or more seats were booked while you were signing in. Please review your seats.");
            sessionStorage.removeItem(PENDING_KEY);
          }
        }
      })
      .catch((e) => !cancelled && setError(e.message || "Unable to load seats."))
      .finally(() => !cancelled && setSeatLoading(false));

    const socket = connectShowtime(selectedShowtimeId, (message) => {
      if (message.type === "CONNECTED" || message.type === "JOINED_SHOWTIME") setConnected(true);
      if (message.type === "SEAT_BOOKED") {
        setBookedSeats((previous) => [...new Set([...previous, ...(message.seats || [])])]);
        setSelectedSeats((previous) => previous.filter((seat) => !(message.seats || []).includes(seat)));
      }
    });

    return () => { cancelled = true; socket?.close(); setConnected(false); };
  }, [selectedShowtimeId, movieId]);

  const total = useMemo(
    () => selectedSeats.length * Number(showtimeDetails?.price || 0),
    [selectedSeats, showtimeDetails]
  );

  const createBooking = useCallback(async (showtimeId, seats) => {
    if (!showtimeId || !seats?.length || isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    try {
      const booking = await api("/bookings", {
        method: "POST",
        body: JSON.stringify({ showtimeId, seats })
      });
      sessionStorage.removeItem(PENDING_KEY);
      navigate(`/booking-confirmation/${booking._id}`, { replace: true });
    } catch (e) {
      setError(e.message || "Booking failed. Please check seat availability and try again.");
      setIsSubmitting(false);
      resumedRef.current = true;
    }
  }, [isSubmitting, navigate]);

  // Auto-submit the pending booking after returning from the login page.
  useEffect(() => {
    if (!resumeBooking || !user || !resumeReady || !showtimeDetails || !selectedSeats.length || resumedRef.current || isSubmitting) return;
    const saved = readPendingBooking();
    if (saved?.movieId !== movieId || saved?.showtimeId !== selectedShowtimeId) return;
    resumedRef.current = true;
    // Intentional: createBooking is async; this is a one-time "resume after login" flow.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    createBooking(selectedShowtimeId, selectedSeats);
  }, [resumeBooking, user, resumeReady, showtimeDetails, selectedSeats, movieId, selectedShowtimeId, isSubmitting, createBooking]);

  function selectShowtime(id) {
    if (id === selectedShowtimeId) return;
    setSelectedShowtimeId(id);
    setShowtimeDetails(null);
    setBookedSeats([]);
    setSelectedSeats([]);
    setResumeReady(false);
    setSeatLoading(true);
    setError("");
    resumedRef.current = false;
  }

  function toggleSeat(seat) {
    setSelectedSeats((previous) => previous.includes(seat)
      ? previous.filter((item) => item !== seat)
      : [...previous, seat]);
  }

  function confirmBooking() {
    if (!selectedShowtimeId || !selectedSeats.length || isSubmitting) return;
    setError("");
    if (!user) {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({
        movieId,
        showtimeId: selectedShowtimeId,
        seats: selectedSeats
      }));
      const returnTo = `/movies/${movieId}?resumeBooking=1`;
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    createBooking(selectedShowtimeId, selectedSeats);
  }

  if (loading) return <div className="combined-state">Loading movie and showtimes…</div>;
  if (!movie) return <div className="combined-state combined-error">{error || "Movie not found."}<p><Link to="/">Back to movies</Link></p></div>;

  return (
    <div className="combined-booking-page">
      <Link className="combined-back-link" to="/">← Back to all movies</Link>

      <section className="combined-movie-hero">
        <div className="combined-poster-wrap">
          <img className="combined-poster" src={movie.poster || "https://placehold.co/400x600?text=Movie"} alt={`${movie.title} poster`} />
        </div>
        <div className="combined-movie-copy">
          <span className="combined-eyebrow">NOW SHOWING</span>
          <h1>{movie.title}</h1>
          <div className="combined-meta">
            <span>{Array.isArray(movie.genre) ? movie.genre.join(" · ") : movie.genre}</span>
            {movie.duration && <span>{movie.duration} min</span>}
            {movie.rating && <span>{movie.rating}</span>}
          </div>
          <p>{movie.description || movie.synopsis || "Choose a screening and your seats to book this movie."}</p>
        </div>
      </section>

      <section className="combined-section" id="showtimes-section">
        <div className="combined-section-heading">
          <div><span className="combined-eyebrow">01 / SCREENING</span><h2>Choose a showtime</h2></div>
          <span className="combined-step-note">Select one screening</span>
        </div>
        {showtimes.length ? (
          <div className="combined-showtime-grid">
            {showtimes.map((showtime) => {
              const active = selectedShowtimeId === showtime._id;
              return (
                <button
                  type="button"
                  key={showtime._id}
                  className={`combined-showtime ${active ? "active" : ""}`}
                  onClick={() => selectShowtime(showtime._id)}
                >
                  {/* Active Checkmark Badge */}
                  {active && <span className="combined-showtime-check">✓</span>}

                  {/* Date at the top */}
                  <span className="combined-showtime-date">{showtime.date}</span>

                  {/* Big bold time in the middle */}
                  <strong>{showtime.startTime}</strong>

                  {/* Hall info & Price pill container at the bottom */}
                  <div className="combined-showtime-footer">
                    <span className="combined-showtime-hall-badge">{showtime.hall?.name || "Cinema Hall"}</span>
                    <span className="combined-showtime-price">RM {Number(showtime.price || 0).toFixed(2)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : <p className="combined-empty">There are no showtimes available for this movie yet.</p>}
      </section>

      <section className="combined-section combined-seats-section">
        <div className="combined-section-heading">
          <div><span className="combined-eyebrow">02 / SEATING</span><h2>Select your seats</h2></div>
          {showtimeDetails && <span className={`combined-live-status ${connected ? "is-live" : ""}`}><i />{connected ? "Live seat updates" : "Connecting to live seating"}</span>}
        </div>
        {!selectedShowtimeId ? <p className="combined-empty">Choose a showtime above to see its seating plan.</p> : seatLoading || !showtimeDetails ? <p className="combined-empty">Loading the seating plan…</p> : (
          <>
            {!showtimeDetails.hall || !Number(showtimeDetails.hall.rows) || !Number(showtimeDetails.hall.seatsPerRow) ? (
              <p className="combined-empty combined-error" role="alert">
                Hall seating information is unavailable for this showtime. Please choose another showtime or contact the cinema administrator.
              </p>
            ) : (
              <>
                <div className="combined-selected-screening"><strong>{showtimeDetails.hall.name || "Cinema Hall"}</strong><span>{showtimeDetails.date} · {showtimeDetails.startTime}</span></div>
                <div className="combined-seat-map"><SeatMap rows={Number(showtimeDetails.hall.rows)} seatsPerRow={Number(showtimeDetails.hall.seatsPerRow)} bookedSeats={bookedSeats} selectedSeats={selectedSeats} onToggle={toggleSeat} /></div>
              </>
            )}
          </>
        )}
      </section>

      {error && <div className="combined-error-banner" role="alert">{error}</div>}

      <section className="combined-checkout">
        <div className="combined-checkout-seats"><span className="combined-eyebrow">YOUR SELECTION</span><strong>{showtimeDetails?.hall?.name || "Cinema Hall"} - {selectedSeats.length ? selectedSeats.join(", ") : "No seats selected"}</strong><small> {selectedSeats.length} {selectedSeats.length === 1 ? "seat" : "seats"} · No payment required</small></div>
        <div className="combined-checkout-total"><span>Total</span><strong>RM {total.toFixed(2)}</strong></div>
        <button className="combined-confirm-button" onClick={confirmBooking} disabled={!selectedShowtimeId || !selectedSeats.length || seatLoading || isSubmitting}>
          {isSubmitting ? "Creating booking…" : user ? "Confirm Booking →" : "Login to Confirm →"}
        </button>
      </section>
      <p className="combined-auth-note">{user ? `Signed in as ${user.name || user.email}.` : "You'll be asked to log in or register before your booking is created. Your selection will be kept."}</p>
    </div>
  );
}