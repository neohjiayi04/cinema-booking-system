# Cinema Booking System — Version 1

Stack:
- React + Vite + JavaScript
- Node.js + Express
- Native WebSocket (`ws`)
- MongoDB
- Docker Compose
- JWT + bcryptjs

## Run

```bash
docker compose up -d --build
```

Open:

- Frontend: http://localhost:5173
- Backend health: http://localhost:3000/api/health

## Seed data

After the containers are running:

```bash
docker compose exec backend npm run seed
```

Seeded accounts:

- Admin: admin@cinema.local / Admin123!
- Customer: customer@cinema.local / Customer123!

## Multi-computer test

Run Docker on one computer connected to the same LAN.

Find that computer's LAN IP, for example `192.168.1.100`.

On another computer, open:

`http://192.168.1.100:5173`

For the current Docker setup, if the frontend is accessed from another computer, set these in `docker-compose.yml`:

```yaml
VITE_API_URL: http://192.168.1.100:3000/api
VITE_WS_URL: ws://192.168.1.100:3000
```

Then rebuild:

```bash
docker compose up --build
```

Open the same showtime on two computers. Book a seat on Computer A and Computer B should receive a real-time `SEAT_BOOKED` WebSocket event.

## Important

This is a Version 1 foundation. It intentionally uses a simple booking rule:
- selecting a seat selects it locally
- clicking Confirm Booking creates the booking immediately
- there is no payment
- there is no temporary 5-minute hold

