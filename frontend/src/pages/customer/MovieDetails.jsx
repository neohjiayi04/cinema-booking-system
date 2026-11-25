import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import SeatMap from "../../components/SeatMap.jsx";
import SeatPreview3D, { PreviewSwitch } from "../../components/SeatPicker/SeatPreview3D.jsx";
import { api } from "../../services/api.js";
import { connectShowtime } from "../../services/websocket.js";
import { MOVIE_STATUS, MOVIE_STATUS_LABELS, statusOf, formatDate } from "../../constants/movieOptions.js";
import { dateTabLabel, groupByDate, hasStarted, upcomingShowtimes } from "../../constants/showtimeTime.js";
import "../../styles/MovieDetails.css";
import "../../styles/BookingLayout.css";

const PENDING_KEY = "cinemax.pendingBooking";
const CLOCK_TICK_MS = 30000; // how often the page re-checks whether a showtime has started

function readPendingBooking() {
  try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null"); }
  catch { return null; }
}

// Works out which seat a mouse/keyboard event is on, from the seat button's title or aria-label
// (e.g. "Seat A01 - Available" or "Row A, seat 1"). Returns "A01", or null if it can't tell.
function seatIdFromEvent(event) {
  const element = event.target?.closest?.("[title], [aria-label]");
  const text = element?.getAttribute("title") || element?.getAttribute("aria-label") || "";
  const label = /\b([A-Z])\s?0?(\d{1,2})\b/.exec(text) || /Row\s+([A-Z]),?\s+seat\s+(\d{1,2})/i.exec(text);
  return label ? `${label[1].toUpperCase()}${label[2].padStart(2, "0")}` : null;
}

// Date tabs + time chips. Only showtimes that haven't started are passed in.
function ShowtimePicker({ groups, selectedId, activeDate, today, onSelect }) {
  if (!groups.length) {
    return <p className="cb-when-empty">There are no upcoming showtimes for this movie.</p>;
  }
  const activeItems = groups.find(([date]) => date === activeDate)?.[1] || [];
  return (
    <>
      <div className="cb-tabs" aria-label="Choose a date">
        {groups.map(([date, items]) => (
          <button
            type="button"
            key={date}
            className={`cb-tab ${date === activeDate ? "is-on" : ""}`}
            aria-pressed={date === activeDate}
            onClick={() => date !== activeDate && onSelect(items[0]._id)}
          >
            {dateTabLabel(date, today)}
          </button>
        ))}
      </div>
      <div className="cb-chips" aria-label="Choose a showtime">
        {activeItems.map((showtime) => (
          <button
            type="button"
            key={showtime._id}
            className={`cb-chip ${selectedId === showtime._id ? "is-on" : ""}`}
            aria-pressed={selectedId === showtime._id}
            onClick={() => onSelect(showtime._id)}
          >
            <strong>{showtime.startTime}</strong>
            <span>{showtime.hall?.name || "Cinema Hall"} · RM {Number(showtime.price || 0).toFixed(2)}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// Popup for "this showtime has passed" and similar booking rules.
function NoticeDialog({ message, onClose }) {
  const buttonRef = useRef(null);
  useEffect(() => { buttonRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="cb-modal-backdrop" onClick={onClose}>
      <div
        className="cb-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cb-modal-title"
        aria-describedby="cb-modal-text"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="cb-modal-title">Showtime unavailable</h2>
        <p id="cb-modal-text">{message}</p>
        <button ref={buttonRef} type="button" className="combined-confirm-button" onClick={onClose}>Choose another showtime</button>
      </div>
    </div>
  );
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
  const [notice, setNotice] = useState(""); // popup text (passed showtime etc.)
  const [resumeReady, setResumeReady] = useState(false);
  const [showPreview, setShowPreview] = useState(true); // 3D hall preview beside the map; the customer can switch it off
  const [hoverId, setHoverId] = useState(null);
  const [descOpen, setDescOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const resumedRef = useRef(false);

  // Keep "now" fresh so showtimes disappear (and the popup appears) when their start time passes.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

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
        // Showtimes that already started are never offered.
        const upcoming = upcomingShowtimes(showtimeData || [], Date.now());
        const saved = readPendingBooking();
        const savedShowtime = saved?.movieId === movieId ? saved.showtimeId : "";
        const savedStillOpen = Boolean(savedShowtime) && upcoming.some((showtime) => showtime._id === savedShowtime);
        if (canBook && savedShowtime && !savedStillOpen) {
          sessionStorage.removeItem(PENDING_KEY);
          setNotice("The showtime you chose has already started or is no longer available. Please choose another showtime.");
        }
        const initialId = canBook ? (savedStillOpen ? savedShowtime : (upcoming[0]?._id || "")) : "";
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

  // Showtimes that have not started yet, grouped by date. Started ones are hidden completely.
  const upcoming = useMemo(() => upcomingShowtimes(showtimes, now), [showtimes, now]);
  const showtimeGroups = useMemo(() => groupByDate(upcoming), [upcoming]);
  const selectedShowtime = useMemo(
    () => showtimes.find((showtime) => showtime._id === selectedShowtimeId) || null,
    [showtimes, selectedShowtimeId]
  );
  // The chosen showtime started while the page was open.
  const selectedStarted = selectedShowtime ? hasStarted(selectedShowtime, now) : false;
  const activeDate = selectedShowtime && !selectedStarted ? selectedShowtime.date : showtimeGroups[0]?.[0];
  const dialogMessage = notice || (selectedStarted
    ? `The ${selectedShowtime.startTime} showtime on ${selectedShowtime.date} has already started. Please choose another showtime.`
    : "");

  // The hall's seats in the shape the 3D preview expects (ids are your seat labels, e.g. "F06").
  const previewSeats = useMemo(() => {
    const hall = showtimeDetails?.hall;
    if (!showPreview || !hall) return [];
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
  }, [showPreview, showtimeDetails, bookedSeats]);

  const createBooking = useCallback(async (showtimeId, seats) => {
    if (!showtimeId || !seats?.length || isSubmitting) return;
    // Rule: a showtime that has already started can't be booked.
    const showtime = showtimes.find((item) => item._id === showtimeId);
    if (showtime && hasStarted(showtime, Date.now())) {
      setNotice(`The ${showtime.startTime} showtime on ${showtime.date} has already started. Please choose another showtime.`);
      return;
    }
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
      const message = e.message || "Booking failed. Please check seat availability and try again.";
      setError(message);
      // If the server rejected it because the showtime has passed, say so in a popup as well.
      if (/(already started|has started|has passed|already passed|in the past)/i.test(message)) setNotice(message);
      setIsSubmitting(false);
      resumedRef.current = true;
    }
  }, [isSubmitting, navigate, showtimes]);

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
    setSeatLoading(Boolean(id));
    setError("");
    setHoverId(null);
    resumedRef.current = false;
  }

  // Closes the popup; if the chosen showtime is the one that passed, move to the next upcoming one.
  function closeDialog() {
    setNotice("");
    if (selectedStarted) selectShowtime(upcoming[0]?._id || "");
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

  const status = statusOf(movie);
  const bookable = movie.bookable ?? status === MOVIE_STATUS.NOW_SHOWING;
  const genreText = Array.isArray(movie.genre) ? movie.genre.join(" · ") : movie.genre;
  const description = movie.description || movie.synopsis || "Choose a screening and your seats to book this movie.";
  const hallReady = Boolean(showtimeDetails?.hall) && Number(showtimeDetails.hall.rows) > 0 && Number(showtimeDetails.hall.seatsPerRow) > 0;

  return (
    <div className="combined-booking-page">
      <Link className="combined-back-link" to="/">← Back to all movies</Link>

      {!bookable ? (
        <>
          <section className="combined-movie-hero">
            <div className="combined-poster-wrap">
              <img className="combined-poster" src={movie.poster || "https://placehold.co/400x600?text=Movie"} alt={`${movie.title} poster`} />
            </div>
            <div className="combined-movie-copy">
              <span className="combined-eyebrow">{MOVIE_STATUS_LABELS[status].toUpperCase()}</span>
              <h1>{movie.title}</h1>
              <div className="combined-meta">
                <span>{genreText}</span>
                {movie.duration && <span>{movie.duration} min</span>}
                {movie.rating && <span>{movie.rating}</span>}
              </div>
              <p>{description}</p>
            </div>
          </section>

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
        </>
      ) : (
        <>
          {/* Concise movie header */}
          <header className="cb-head">
            <img src={movie.poster || "https://placehold.co/400x600?text=Movie"} alt={`${movie.title} poster`} />
            <div>
              <div className="cb-head-top">
                <span className="combined-eyebrow">{MOVIE_STATUS_LABELS[status].toUpperCase()}</span>
                <h1>{movie.title}</h1>
              </div>
              <div className="combined-meta">
                {genreText && <span>{genreText}</span>}
                {movie.duration && <span>{movie.duration} min</span>}
                {movie.rating && <span>{movie.rating}</span>}
                {movie.endDate && <span>Showing until {formatDate(movie.endDate)}</span>}
              </div>
              <p className={`cb-desc ${descOpen ? "is-open" : ""}`}>{description}</p>
              {description.length > 150 && (
                <button type="button" className="cb-more" aria-expanded={descOpen} onClick={() => setDescOpen((open) => !open)}>
                  {descOpen ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          </header>

          {/* Date tabs + time chips: pinned while you scroll the seats */}
          <section className="cb-when" id="showtimes-section" aria-label="Showtimes">
            <ShowtimePicker
              groups={showtimeGroups}
              selectedId={selectedShowtimeId}
              activeDate={activeDate}
              today={now}
              onSelect={selectShowtime}
            />
          </section>

          {/* Seat map (left) + 3D hall preview (right) */}
          <section className="combined-seats-section">
            <div className="cb-seating-head">
              <h2>Select your seats</h2>
              <div className="cb-seating-tools">
                {showtimeDetails && <span className={`combined-live-status ${connected ? "is-live" : ""}`}><i />{connected ? "Live seat updates" : "Connecting to live seating"}</span>}
                {selectedShowtimeId && <PreviewSwitch checked={showPreview} onChange={setShowPreview} />}
              </div>
            </div>
            {!selectedShowtimeId ? <p className="combined-empty">Choose a showtime above to see its seating plan.</p> : seatLoading || !showtimeDetails ? <p className="combined-empty">Loading the seating plan…</p> : (
              !hallReady ? (
                <p className="combined-empty combined-error" role="alert">
                  Hall seating information is unavailable for this showtime. Please choose another showtime or contact the cinema administrator.
                </p>
              ) : (
                <div className={`cb-seatgrid ${showPreview ? "has-preview" : ""}`}>
                  <div
                    className="combined-seat-map"
                    onMouseOver={(event) => setHoverId(seatIdFromEvent(event))}
                    onMouseLeave={() => setHoverId(null)}
                    onFocus={(event) => setHoverId(seatIdFromEvent(event))}
                    onBlur={() => setHoverId(null)}
                  >
                    <SeatMap rows={Number(showtimeDetails.hall.rows)} seatsPerRow={Number(showtimeDetails.hall.seatsPerRow)} bookedSeats={bookedSeats} selectedSeats={selectedSeats} onToggle={toggleSeat} />
                  </div>
                  {showPreview && (
                    <div className="cb-preview">
                      <SeatPreview3D seats={previewSeats} selected={selectedSeats} hoverId={hoverId} />
                    </div>
                  )}
                </div>
              )
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

          {dialogMessage && <NoticeDialog message={dialogMessage} onClose={closeDialog} />}
        </>
      )}
    </div>
  );
}