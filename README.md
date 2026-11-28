# 🎬 CINEMAX — Cinema Booking System

A full-stack web app where customers browse movies, pick seats on a live seat map and manage their bookings, while administrators manage movies, halls, showtimes, users and bookings.

**Highlights:** real-time seat sync (WebSocket) · server-side booking validation · role-based access (JWT) · automated tests · Docker + CI/CD

> Academic project. Online payment is not included.



## ✨ Features

**Customer**
- Register / log in, browse movies, view details and showtimes
- Interactive seat map with real-time availability (no double booking)
- Automatic total, unique booking reference and QR code
- Booking history (upcoming / completed / cancelled), cancel or update eligible bookings

**Administrator**
- Dashboard to manage movies, halls, showtimes, users and bookings
- Showtime end time is calculated from movie duration, with cleaning time between shows
- Preview the customer page without signing out

**Key System Highlights**
| Feature | Benefit |
|---|---|
| Real-time seat synchronisation | Reduces conflicting seat selections |
| Server-side booking validation | Protects business rules from client-side manipulation |
| Interactive seat map | Provides intuitive seat selection |
| QR booking confirmation | Provides convenient booking verification |
| Booking history tabs | Separates upcoming and past bookings |
| Automatic movie end time | Reduces manual scheduling errors |
| Cleaning-time consideration | Helps prevent overlapping showtimes |
| Admin customer-page preview | Allows admins to inspect the customer experience |
| Role-based access control | Separates customer and admin privileges |
| Docker deployment | Provides a consistent development environment |
| Automated CI testing | Detects regressions before integration |

 

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite |
| Backend | Node.js, Express |
| Database | MongoDB |
| Auth | JWT, bcrypt |
| Real-time | WebSocket (`ws`) |
| Deployment | Docker Compose, Nginx |
| Testing / CI | Node.js Test Runner, ESLint, GitHub Actions, GHCR |

 

## 🏗️ Architecture

```text
Browser ──► React + Vite (5174) ──REST──► Express API (3001) ──► MongoDB (27019)
                                              │
                                              └── WebSocket ──► live seat updates
```

**Data model:** `users`, `movies`, `halls`, `showtimes`, `bookings`
(Each booking belongs to a showtime, which links a movie to a hall)

 

## 🚀 Quick Start

Requires **Docker Desktop** (Node.js 22+ only if running without Docker).

```bash
git clone <repository-url>
cd cinema-booking-system
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5174 |
| Backend API | http://localhost:3001/api |
| WebSocket | ws://localhost:3001 |

Stop with `docker compose down`. Demo data (1 cinema, 3 halls, sample movies, showtimes, users and bookings) is seeded without duplicating existing records.

| Area | Command | Purpose |
|---|---|---|
| **Development** | `npm run dev` | Start development server |
| | `npm start` | Start production server |
| | `npm run seed` | Seed database |

 

## 🔐 Roles & Security

| Role | Can do |
|---|---|
| Customer | Browse, select seats, book, manage own bookings |
| Administrator | Everything above plus manage movies, halls, showtimes, users and all bookings |

- Passwords hashed with bcrypt; protected routes check JWT and role
- Critical rules are enforced **on the server**, not only in the UI: duplicate or already-booked seats are rejected, seats must belong to the hall, totals are computed from selected seats

 

## 📡 API & Real-Time

REST base: `http://localhost:3001/api`

```text
/api/auth   /api/movies   /api/halls   /api/showtimes   /api/bookings   /api/users
```

```text
GET  /api/bookings/my      POST   /api/bookings
GET  /api/bookings/:id     PUT    /api/bookings/:id     DELETE /api/bookings/:id
```

WebSocket events broadcast to everyone viewing the same showtime: `SEAT_BOOKED`, `SEATS_UPDATED`, `SEATS_RELEASED`.

 

## 🧪 Testing

| Area | Command | Purpose |
|---|---|---|
| **Frontend** | `npm test` | Run all frontend tests |
| | `npm run test:unit` | Run frontend unit tests |
| | `npm run test:watch` | Run tests in watch mode |
| | `npm run test:verbose` | Run tests with verbose output |
| | `npm run test:jest-style` | Run tests with Jest-style reporter |
| | `npm run lint` | Run ESLint |
| **Backend** | `npm test` | Run all backend tests |
| | `npm run test:unit` | Run backend unit tests |
| | `npm run test:integration` | Run backend integration tests |
| | `npm run test:clean` | Run tests with Jest-style reporter |
| | `npm run lint` | Run ESLint |

Tests cover authentication and authorisation, seat selection and validation (duplicate / unavailable seats), booking totals and business rules, API behaviour and frontend components.

 

## 🔄 CI/CD

GitHub Actions runs on every push:

```text
Install → Frontend lint / test / build → Backend syntax check / test / lint → Health smoke test → Publish Docker images to GHCR
```

 

## 📁 Project Structure

```text
cinema-booking-system/
├── .github/workflows/ci-cd.yml   # CI/CD pipeline
├── backend/
│   ├── src/                      # app, auth, config, db, seed, server, utils/
│   └── tests/                    # unit + integration tests
├── frontend/
│   └── src/
│       ├── components/           # Navbar, MovieCard, SeatMap, AdminLayout
│       ├── pages/                # customer/ and admin/ pages
│       ├── context/              # AuthContext
│       ├── services/             # api.js, websocket.js
│       └── styles/
├── docker-compose.yml
└── README.md
```

 

## 📄 License

Developed for academic purposes.
