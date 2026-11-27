const API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3001/api`;

export async function api(path, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  // The saved token was rejected (expired after 2 hours, or the server's secret
  // changed). Drop it and send the user to the login page instead of leaving every
  // page failing with "Invalid or expired token". Wrong-password logins are not
  // session expiry, so the auth endpoints are excluded.
  if (response.status === 401 && token && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    if (window.location.pathname !== "/login") {
      window.location.assign("/login");
    }

    const expired = new Error("Your session has expired. Please log in again.");
    expired.status = 401;
    throw expired;
  }

  if (!response.ok) {
    // Show only the readable server message in the pop-up
    // (no "409 Conflict:" prefix). The status stays available on the error.
    const error = new Error(
      data.message || `Request failed (${response.status})`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}