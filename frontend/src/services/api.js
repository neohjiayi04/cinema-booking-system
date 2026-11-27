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