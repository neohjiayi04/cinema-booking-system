Before closing your laptop
1. Make sure your work is saved

Save your code in VS Code (Ctrl + S). If you have unsaved changes, save them first.



2. Stop your Docker containers

Open PowerShell in your project folder and run:
docker compose stop


This stops the frontend, backend, and MongoDB containers without deleting them or their stored database data.



3. Close your applications

You can close VS Code, PowerShell, your browser, and MongoDB Compass, then shut down or close your laptop.



When you want to use your system again
1. Open Docker Desktop and wait until it is running.
2. Open PowerShell and navigate to your project folder:
   cd "C:\Users\neohj\OneDrive\Documents\fullstack\cinema-booking-system"
3. Start your system:
   docker compose start
4. Open your browser at http://localhost:5173.
Your existing movies, showtimes, halls, users, and bookings should remain in the database.
Important things to remember
- Don't run docker compose down -v just to stop your system. The -v option can delete the database volume and its stored data.
- You don't need to manually stop MongoDB separately when it is running inside Docker.
- If you have changed your code or Docker configuration, you may need to rebuild the relevant container instead of simply running docker compose start.
- If you want to close your laptop temporarily and keep everything running, sleep mode may pause or interrupt the services. Stopping the containers first is the safer, cleaner option.