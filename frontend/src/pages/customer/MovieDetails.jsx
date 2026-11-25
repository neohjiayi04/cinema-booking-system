import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import SeatMap from "../../components/SeatMap.jsx";
import ViewToggle from "../../components/SeatPicker/ViewToggle.jsx";
import { api } from "../../services/api.js";
import { connectShowtime } from "../../services/websocket.js";
import { MOVIE_STATUS, MOVIE_STATUS_LABELS, statusOf, formatDate } from "../../constants/movieOptions.js";
import "../../styles/MovieDetails.css";

// lazy: the 3D code (three.js) only downloads when the customer switches to the 3D view
const SeatPicker = lazy(() => import("../../components/SeatPicker/SeatPicker.jsx"));

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
  const [viewMode, setViewMode] = useState("2d"); // "2d" = your flat SeatMap (default), "3d" = SeatPicker with the 3D view
  const resumedRef = useRef(false);

  // Load movie + showtimes (runs once per mount; remounts when movieId changes)
  useEffect(() => {
    let cancelled = false;
    Promise.all([api(`/movies/${movieId}`), api(`/showtimes?movieId=${movieId}`)])
      .then(([movieData, showtimeData]) => {
        if (cancelled) return;
        setMovie(movieData);
        setShowtimes(showtimeData || []);
        // Movies that aren't Now Showing (coming soon, ended, archived) can't be booked,
        // so don't preselect a showtime or open the live seat connection for them.
        const canBook = (movieData.bookable ?? statusOf(movieData) === MOVIE_STATUS.NOW_SHOWING);
        const saved = readPendingBooking();
        const savedShowtime = saved?.movieId === movieId ? saved.showtimeId : "";
        const initialId = canBook ? (savedShowtime || showtimeData?.[0]?._id || "") : "";
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

  // The same seats in the shape the 3D SeatPicker expects (ids are your seat labels, e.g. "F06").
  const pickerSeats = useMemo(() => {
    const hall = showtimeDetails?.hall;
    if (!hall) return [];
    const result = [];
    for (let row = 0; row < Number(hall.rows); row++) {
      const rowLabel = String.fromCharCode(65 + row);
      for (let seatNumber = 1; seatNumber <= Number(hall.seatsPerRow); seatNumber++) {
        const label = `${rowLabel}${String(seatNumber).padStart(2, "0")}`;
        result.push({
          _id: label,
          row: rowLabel,
          number: seatNumber,
          price: Number(showtimeDetails.price || 0),
          status: bookedSeats.includes(label) ? "booked" : "available",
          seatType: "STANDARD"
        });
      }
    }
    return result;
  }, [showtimeDetails, bookedSeats]);

  // Returns the error message when the booking fails (undefined on success, because we navigate away).
  const createBooking = useCallback(async (showtimeId, seats) => {
    if (!showtimeId || !seats?.length || isSubmitting) return undefined;
    setError("");
    setIsSubmitting(true);
    try {
      const booking = await api("/bookings", {
        method: "POST",
        body: JSON.stringify({ showtimeId, seats })
      });
      sessionStorage.removeItem(PENDING_KEY);
      navigate(`/booking-confirmation/${booking._id}`, { replace: true });
      return undefined;
    } catch (e) {
      const message = e.message || "Booking failed. Please check seat availability and try again.";
      setError(message);
      setIsSubmitting(false);
      resumedRef.current = true;
      return message;
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

  // The two views keep their own selections, so switching starts a fresh pick.
  function changeView(mode) {
    if (mode === viewMode) return;
    setViewMode(mode);
    setSelectedSeats([]);
    setError("");
  }

  // Saves the seats and sends a logged-out customer to log in; returns true if it did.
  function redirectToLogin(seats) {
    if (user) return false;
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({
      movieId,
      showtimeId: selectedShowtimeId,
      seats
    }));
    const returnTo = `/movies/${movieId}?resumeBooking=1`;
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    return true;
  }

  function confirmBooking() {
    if (!selectedShowtimeId || !selectedSeats.length || isSubmitting) return;
    setError("");
    if (redirectToLogin(selectedSeats)) return;
    createBooking(selectedShowtimeId, selectedSeats);
  }

  // 3D view: the SeatPicker's own Book button ends up here.
  async function confirmPickedSeats(picked) {
    if (!selectedShowtimeId || !picked.length || isSubmitting) return;
    const seatIds = picked.map((seat) => seat.raw._id);
    if (redirectToLogin(seatIds)) return;
    const failure = await createBooking(selectedShowtimeId, seatIds);
    if (failure) throw new Error(failure);
  }

  if (loading) return <div className="combined-state">Loading movie and showtimes…</div>;
  if (!movie) return <div className="combined-state combined-error">{error || "Movie not found."}<p><Link to="/">Back to movies</Link></p></div>;

  const status = statusOf(movie);
  const bookable = movie.bookable ?? status === MOVIE_STATUS.NOW_SHOWING;
  const is3D = viewMode === "3d";

  return (
    <div className="combined-booking-page">
      <Link className="combined-back-link" to="/">← Back to all movies</Link>

      <section className="combined-movie-hero">
        <div className="combined-poster-wrap">
          <img className="combined-poster" src={movie.poster || "https://placehold.co/400x600?text=Movie"} alt={`${movie.title} poster`} />
        </div>
        <div className="combined-movie-copy">
          <span className="combined-eyebrow">{MOVIE_STATUS_LABELS[status].toUpperCase()}</span>
          <h1>{movie.title}</h1>
          <div className="combined-meta">
            <span>{Array.isArray(movie.genre) ? movie.genre.join(" · ") : movie.genre}</span>
            {movie.duration && <span>{movie.duration} min</span>}
            {movie.rating && <span>{movie.rating}</span>}
            {bookable && movie.endDate && <span>Showing until {formatDate(movie.endDate)}</span>}
          </div>
          <p>{movie.description || movie.synopsis || "Choose a screening and your seats to book this movie."}</p>
        </div>
      </section>

      {!bookable ? (
        <section className={`combined-section combined-status-panel status-${status.toLowerCase().replace("_", "-")}`} role="status">
          {status === MOVIE_STATUS.COMING_SOON && (
            <>
              <h2>Coming soon</h2>
              <p>
                You can read about this movie now, but booking isn&apos;t open yet.
                {movie.releaseDate && <> Booking opens on <strong>{formatDate(movie.releaseDate)}</strong>.</>}
              </p>
            </>
          )}
          {status === MOVIE_STATUS.ENDED && (
            <>
              <h2>No longer showing</h2>
              <p>
                This movie has finished its run
                {movie.endDate && <> (ended <strong>{formatDate(movie.endDate)}</strong>)</>} and can no longer be booked.
              </p>
            </>
          )}
          {status === MOVIE_STATUS.ARCHIVED && (
            <>
              <h2>Archived</h2>
              <p>This movie is archived and is no longer available for booking.</p>
            </>
          )}
          <Link className="combined-back-link" to="/">Browse movies now showing</Link>
        </section>
      ) : (
        <>
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
                <ViewToggle value={viewMode} onChange={changeView} />
                <div className="combined-selected-screening"><strong>{showtimeDetails.hall.name || "Cinema Hall"}</strong><span>{showtimeDetails.date} · {showtimeDetails.startTime}</span></div>
                {is3D ? (
                  <div className="combined-seat-map sp-embed">
                    <Suspense fallback={<p className="combined-empty">Loading 3D seats…</p>}>
                      <SeatPicker seats={pickerSeats} mode="3d" onConfirm={confirmPickedSeats} busy={isSubmitting} />
                    </Suspense>
                  </div>
                ) : (
                  <div className="combined-seat-map"><SeatMap rows={Number(showtimeDetails.hall.rows)} seatsPerRow={Number(showtimeDetails.hall.seatsPerRow)} bookedSeats={bookedSeats} selectedSeats={selectedSeats} onToggle={toggleSeat} /></div>
                )}
              </>
            )}
          </>
        )}
      </section>

      {error && <div className="combined-error-banner" role="alert">{error}</div>}

      {!is3D && (
        <section className="combined-checkout">
          <div className="combined-checkout-seats"><span className="combined-eyebrow">YOUR SELECTION</span><strong>{showtimeDetails?.hall?.name || "Cinema Hall"} - {selectedSeats.length ? selectedSeats.join(", ") : "No seats selected"}</strong><small> {selectedSeats.length} {selectedSeats.length === 1 ? "seat" : "seats"} · No payment required</small></div>
          <div className="combined-checkout-total"><span>Total</span><strong>RM {total.toFixed(2)}</strong></div>
          <button className="combined-confirm-button" onClick={confirmBooking} disabled={!selectedShowtimeId || !selectedSeats.length || seatLoading || isSubmitting}>
            {isSubmitting ? "Creating booking…" : user ? "Confirm Booking →" : "Login to Confirm →"}
          </button>
        </section>
      )}
      <p className="combined-auth-note">{user ? `Signed in as ${user.name || user.email}.` : "You'll be asked to log in or register before your booking is created. Your selection will be kept."}</p>
        </>
      )}
    </div>
  );
}
