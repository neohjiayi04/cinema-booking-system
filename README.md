# 🎬 CINEMAX — Cinema Booking System

A full-stack web-based cinema booking system that allows customers to browse movies, select seats, make and manage bookings, while administrators manage movies, halls, showtimes, users and bookings.

The system focuses on **real-time seat synchronisation, booking validation, role-based access control, automated testing and containerised deployment**.

---

## ✨ Features

### 👤 Customer

- Register and log in securely
- Browse available movies
- View movie details, duration and showtimes
- Select seats using an interactive seat map
- View real-time seat availability
- Prevent duplicate or unavailable seat selection
- Calculate booking totals automatically
- Receive a unique booking reference
- Generate a booking QR code
- View booking history
- Separate upcoming, completed and cancelled bookings
- View booking details and selected seats
- Cancel eligible bookings
- Update eligible bookings according to business rules

### 🛠️ Administrator

- Secure admin authentication
- Role-based access control
- Dashboard for system management
- Manage movies
- Manage cinema halls and seating configurations
- Manage showtimes
- Manage customer bookings
- Manage users
- Preview the customer-facing movie page without signing out
- Automatically calculate movie end time from movie duration
- Account for cleaning time when scheduling showtimes

### ⚡ Real-Time Booking

- WebSocket-based seat synchronisation
- Updates seat availability without page refresh
- Synchronises changes between connected clients
- Helps prevent conflicting seat selections
- Supports booking, update and seat-release events

---

## 🏗️ System Architecture

```text
┌──────────────────────────────┐
│       Customer / Admin       │
│          Web Browser         │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│       React + Vite           │
│          Frontend            │
│         Port: 5174           │
└──────────────┬───────────────┘
               │ REST API
               ▼
┌──────────────────────────────┐
│       Node.js + Express      │
│          Backend             │
│         Port: 3001           │
│                              │
│ Authentication / RBAC        │
│ Booking Validation           │
│ Business Rules               │
│ WebSocket Server              │
└───────┬──────────────┬───────┘
        │              │
        │ MongoDB      │ WebSocket
        ▼              ▼
┌───────────────┐   Real-Time
│   MongoDB     │   Seat Updates
│   Port: 27019 │
└───────────────┘
```

---

## 🧰 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, JavaScript, Vite |
| Backend | Node.js, Express |
| Database | MongoDB |
| Authentication | JWT, bcrypt |
| Real-time communication | WebSocket (`ws`) |
| Web server | Nginx |
| Containerisation | Docker, Docker Compose |
| Testing | Node.js Test Runner, frontend testing tools |
| CI/CD | GitHub Actions, GitHub Container Registry |

---

## 🗄️ Database Design

CINEMAX uses five MongoDB collections:

- `users`
- `movies`
- `halls`
- `showtimes`
- `bookings`

### Relationships

```text
User
 │
 └── Booking
       │
       └── Showtime
             ├── Movie
             └── Hall
```

MongoDB `ObjectId` references are used to represent relationships between entities.

### Database Rules

- User email addresses must be unique.
- Movies follow defined uniqueness constraints.
- Showtimes reference a movie and hall.
- Movie end time is derived from movie duration.
- Hall seating is generated from configured rows and seats per row.
- Selected seats must belong to the relevant hall.
- Duplicate seats cannot be selected.
- Already-booked seats cannot be booked again.
- Booking totals are calculated from selected seats.
- Booking updates and cancellations follow defined business rules.
- Database indexes support data integrity and booking concurrency.

---

## 🔐 Authentication & Authorisation

CINEMAX uses **JWT authentication** and **role-based access control (RBAC)**.

### Customer

Customers can:

- Browse movies and showtimes
- Select seats
- Create bookings
- View their bookings
- Manage eligible bookings

### Administrator

Administrators can:

- Manage movies
- Manage halls
- Manage showtimes
- Manage users
- Manage bookings
- Access administrative functions
- Preview the customer-facing interface

Passwords are securely hashed using `bcrypt`.

Protected API routes validate authentication and authorisation before allowing access.

---

## 📋 Main User Flows

### Customer Booking Flow

```text
Login
  ↓
Browse Movies
  ↓
View Movie Details
  ↓
Select Showtime
  ↓
Select Seats
  ↓
Check Real-Time Availability
  ↓
Validate Booking
  ↓
Confirm Booking
  ↓
Booking Reference + QR Code
  ↓
View Booking History
```

### Administrator Flow

```text
Admin Login
    ↓
Dashboard
    ├── Manage Movies
    ├── Manage Halls
    ├── Manage Showtimes
    ├── Manage Users
    ├── Manage Bookings
    └── Preview Customer Page
```

---

## 📡 REST API

The backend API runs on:

```text
http://localhost:3001/api
```

Main API areas include:

```text
/api/auth
/api/movies
/api/halls
/api/showtimes
/api/bookings
/api/users
```

Example booking endpoints:

```text
GET    /api/bookings
GET    /api/bookings/my
POST   /api/bookings
GET    /api/bookings/:id
PUT    /api/bookings/:id
DELETE /api/bookings/:id
```

Authentication and role requirements are enforced by the backend.

---

## 🔄 WebSocket Communication

The WebSocket server runs on:

```text
ws://localhost:3001
```

Seat changes are broadcast to connected clients so that users viewing the same showtime receive updated availability automatically.

Example events include:

```text
SEAT_BOOKED
SEATS_UPDATED
SEATS_RELEASED
```

This provides real-time seat synchronisation and reduces the risk of conflicting bookings.

---

## 🧪 Testing

The project includes automated tests covering important frontend and backend functionality.

Testing includes:

- Authentication and authorisation
- Booking validation
- Seat selection
- Duplicate seat rejection
- Unavailable seat rejection
- Booking total calculation
- Booking business rules
- API behaviour
- Frontend interactions
- Backend functionality
- Application health checks

### Example Unit Test

Backend seat validation is tested using:

```text
backend/tests/seatUtils.test.js
```

The tests verify that invalid seat selections, including duplicate or unavailable seats, are rejected before booking processing.

### CI Testing

GitHub Actions automatically performs:

- Frontend linting
- Frontend tests
- Frontend production build
- Backend syntax checks
- Backend tests
- Backend linting
- Backend health smoke tests

---

## 🐳 Docker

The system is containerised using **Docker Compose**.

### Services

- `frontend`
- `backend`
- `mongodb`

### Ports

| Service | Port |
|---|---:|
| Frontend | `5174` |
| Backend API | `3001` |
| MongoDB | `27019` |

MongoDB data is persisted using a Docker volume.

### Start the System

```bash
docker compose up --build
```

### Stop the System

```bash
docker compose down
```

### Rebuild After Changes

```bash
docker compose up --build
```

### Application URLs

```text
Frontend:
http://localhost:5174

Backend:
http://localhost:3001/api

WebSocket:
ws://localhost:3001
```

---

## 🌱 Seed Data

The system supports demonstration data for:

- Users
- Movies
- Halls
- Showtimes
- Bookings

The cinema configuration currently contains:

- **1 cinema**
- **3 halls**

The seed process is designed to avoid unnecessary duplication of existing records.

---

## 📁 Project Structure

```text
cinema-booking-system/
├── .github/
│   └── workflows/
│       └── ci-cd.yml
│
├── backend/
│   ├── src/
│   │   ├── utils/
│   │   │   ├── movieUtils.js
│   │   │   ├── seatUtils.js
│   │   │   └── showtimeUtils.js
│   │   ├── app.js
│   │   ├── auth.js
│   │   ├── config.js
│   │   ├── db.js
│   │   ├── seed.js
│   │   └── server.js
│   ├── tests/
│   │   ├── integration.test.js
│   │   ├── movieUtils.test.js
│   │   ├── seatUtils.test.js
│   │   └── showtimeUtils.test.js
│   ├── .dockerignore
│   ├── Dockerfile
│   ├── eslint.config.js
│   ├── package.json
│   └── package-lock.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdminLayout.jsx
│   │   │   ├── AdminLayout.test.jsx
│   │   │   ├── MovieCard.jsx
│   │   │   ├── MovieCard.test.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── Navbar.test.jsx
│   │   │   ├── SeatMap.jsx
│   │   │   └── SeatMap.test.jsx
│   │   ├── constants/
│   │   │   └── movieOptions.js
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── AuthContext.test.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Login.test.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Register.test.jsx
│   │   │   ├── admin/
│   │   │   │   ├── Bookings.jsx
│   │   │   │   ├── Bookings.test.jsx
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   ├── Dashboard.test.jsx
│   │   │   │   ├── Halls.jsx
│   │   │   │   ├── Halls.test.jsx
│   │   │   │   ├── Movies.jsx
│   │   │   │   ├── Movies.test.jsx
│   │   │   │   ├── Profile.jsx
│   │   │   │   ├── Profile.test.jsx
│   │   │   │   ├── Showtimes.jsx
│   │   │   │   └── Showtimes.test.jsx
│   │   │   └── customer/
│   │   │       ├── BookingConfirmation.jsx
│   │   │       ├── BookingConfirmation.test.jsx
│   │   │       ├── Home.jsx
│   │   │       ├── Home.test.jsx
│   │   │       ├── MovieDetails.jsx
│   │   │       ├── MovieDetails.test.jsx
│   │   │       ├── MyBookings.jsx
│   │   │       ├── MyBookings.test.jsx
│   │   │       ├── SeatBooking.jsx
│   │   │       ├── SeatBooking.test.jsx
│   │   │       ├── UserProfile.jsx
│   │   │       └── UserProfile.test.jsx
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── api.test.js
│   │   │   ├── websocket.js
│   │   │   └── websocket.test.jsx
│   │   ├── styles/
│   │   │   ├── admin.css
│   │   │   ├── AdminBookings.css
│   │   │   ├── BookingConfirmation.css
│   │   │   ├── Home.css
│   │   │   ├── MovieDetails.css
│   │   │   ├── MyBookings.css
│   │   │   ├── Navbar.css
│   │   │   ├── SeatBooking.css
│   │   │   └── UserProfile.css
│   │   ├── test/
│   │   │   └── setup.js
│   │   ├── App.jsx
│   │   ├── App.test.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── .dockerignore
│   ├── Dockerfile
│   ├── eslint.config.js
│   ├── index.html
│   ├── nginx.conf
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── .env
├── .gitignore
├── docker-compose.yml
├── project-structure.txt
└── README.md
```

---

## 🔒 Security

The system applies several security measures:

- JWT-based authentication
- Password hashing with bcrypt
- Role-based authorisation
- Protected API endpoints
- Server-side booking validation
- Database uniqueness constraints
- Input validation
- Seat availability validation
- Backend-enforced business rules

Critical booking rules are enforced on the server rather than relying only on frontend validation.

---

## 🚀 CI/CD

The project uses **GitHub Actions** to automate quality checks.

The CI pipeline follows:

```text
Install Dependencies
        ↓
Frontend Lint
        ↓
Frontend Tests
        ↓
Frontend Build
        ↓
Backend Syntax Check
        ↓
Backend Tests
        ↓
Backend Lint
        ↓
Health Smoke Test
        ↓
Build / Publish Docker Images
```

Successful builds can publish Docker images to **GitHub Container Registry (GHCR)**.

---

## ⭐ Key System Highlights

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

---

## 🧑‍💻 Local Development

### Prerequisites

- Git
- Docker Desktop
- Node.js 22+ for local development

Docker is recommended because it provides the required MongoDB, backend and frontend environment consistently.

### Clone the Repository

```bash
git clone <repository-url>
cd cinema-booking-system
```

### Run the Application

```bash
docker compose up --build
```

Open:

```text
http://localhost:5174
```

---

## 🎯 Project Scope

CINEMAX was developed as an academic full-stack cinema booking system demonstrating:

- Full-stack web development
- RESTful API design
- MongoDB database design
- Authentication and RBAC
- Real-time WebSocket communication
- Booking concurrency handling
- Automated testing
- Docker containerisation
- CI/CD automation
- Responsive customer and administrative interfaces

The system focuses on **cinema booking and management functionality** and does not include online payment processing.

---

## 📄 License

This project was developed for academic purposes.
