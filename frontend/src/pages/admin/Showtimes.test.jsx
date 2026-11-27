import {describe, it,expect,vi,beforeEach,afterEach,} from "vitest";
import {render,screen,fireEvent,waitFor,within,} from "@testing-library/react";

const { mockApi, mockConfirm } = vi.hoisted(() => ({
  mockApi: vi.fn(),
  mockConfirm: vi.fn(),
}));

vi.mock("../../services/api.js", () => ({
  api: mockApi,
}));

// The page reports errors / notices through PopupHost and asks for delete
// confirmation through useConfirm(). Replace both with deterministic versions
// so these tests do not depend on how the real popup is styled or animated.
vi.mock("../../components/Popup.jsx", async () => {
  const { createElement: h, Fragment } = await import("react");

  return {
    default: ({ error, notice }) =>
      h(
        Fragment,
        null,
        error ? h("div", { role: "alert" }, error) : null,
        notice ? h("div", { role: "status" }, notice) : null
      ),
    useConfirm: () => [mockConfirm, null],
  };
});

vi.mock("../../components/ActionButton.jsx", async () => {
  const { createElement: h } = await import("react");

  return {
    default: ({ children, onClick, disabled, title }) =>
      h("button", { type: "button", onClick, disabled, title }, children),
  };
});

import Showtimes from "./Showtimes.jsx";

const movies = [
  { _id: "movie1", title: "Interstellar" },
  { _id: "movie2", title: "Inception" },
];

const halls = [
  { _id: "hall1", name: "Hall 1" },
  { _id: "hall2", name: "Hall 2" },
];

const showtimes = [
  {
    _id: "showtime1",
    movie: { _id: "movie1", title: "Interstellar" },
    hall: { _id: "hall1", name: "Hall 1" },
    date: "2026-11-20T00:00:00.000Z",
    startTime: "19:30",
    price: 18,
  },
  {
    _id: "showtime2",
    movie: { _id: "movie2", title: "Inception" },
    hall: { _id: "hall2", name: "Hall 2" },
    date: "2026-11-21T00:00:00.000Z",
    startTime: "21:00",
    price: 15.5,
  },
];

function renderShowtimes() {
  return render(<Showtimes />);
}

async function waitForShowtimes() {
  await screen.findByRole("heading", {
    name: "All Showtimes",
  });

  await screen.findAllByText("Interstellar");
}

describe("Showtimes Admin Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockApi.mockImplementation((url) => {
      if (url === "/movies") return Promise.resolve(movies);
      if (url === "/halls") return Promise.resolve(halls);
      if (url === "/showtimes") return Promise.resolve(showtimes);

      return Promise.resolve({});
    });

    mockConfirm.mockReset();
    mockConfirm.mockResolvedValue(true);

    vi.stubGlobal("scrollTo", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should display the page heading and description", async () => {
    renderShowtimes();

    await waitForShowtimes();

    expect(
      screen.getByRole("heading", { name: "Showtimes" })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Schedule movies in your cinema halls and manage ticket prices."
      )
    ).toBeInTheDocument();
  });

  it("should display the loading state initially", () => {
    mockApi.mockImplementation(() => new Promise(() => {}));

    renderShowtimes();

    expect(
      screen.getByText("Loading showtimes...")
    ).toBeInTheDocument();
  });

  it("should fetch movies, halls and showtimes from the API", async () => {
    renderShowtimes();

    await waitForShowtimes();

    expect(mockApi).toHaveBeenCalledWith("/movies");
    expect(mockApi).toHaveBeenCalledWith("/halls");
    expect(mockApi).toHaveBeenCalledWith("/showtimes");
  });

  it("should populate the movie and hall selection lists", async () => {
    renderShowtimes();

    await waitForShowtimes();

    expect(screen.getByLabelText("Movie")).toHaveValue("movie1");
    expect(screen.getByLabelText("Hall")).toHaveValue("hall1");

    expect(
      screen.getByRole("option", { name: "Interstellar" })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("option", { name: "Inception" })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("option", { name: "Hall 1" })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("option", { name: "Hall 2" })
    ).toBeInTheDocument();
  });

  it("should display the default ticket price", async () => {
    renderShowtimes();

    await waitForShowtimes();

    expect(screen.getByLabelText("Price (RM)")).toHaveValue(18);
  });

  it("should display all scheduled showtimes", async () => {
    renderShowtimes();

    await waitForShowtimes();

    const table = screen.getByRole("table");
    const tableContent = within(table);

    expect(
      tableContent.getByText("Interstellar")
    ).toBeInTheDocument();

    expect(
      tableContent.getByText("Inception")
    ).toBeInTheDocument();

    expect(tableContent.getByText("2026-11-20")).toBeInTheDocument();
    expect(tableContent.getByText("2026-11-21")).toBeInTheDocument();

    // The component formats times with toLocaleTimeString (e.g. "7:30 PM"),
    // so match the formatted output and tolerate locale whitespace differences.
    expect(tableContent.getByText(/^7:30\s*PM$/i)).toBeInTheDocument();
    expect(tableContent.getByText(/^9:00\s*PM$/i)).toBeInTheDocument();

    expect(tableContent.getByText("RM 18.00")).toBeInTheDocument();
    expect(tableContent.getByText("RM 15.50")).toBeInTheDocument();
  });

  it("should display the scheduled showtime count", async () => {
    renderShowtimes();

    await waitForShowtimes();

    expect(
      screen.getByText("2 showtimes configured")
    ).toBeInTheDocument();
  });

  it("should display an empty state when no showtimes exist", async () => {
    mockApi.mockImplementation((url) => {
      if (url === "/movies") return Promise.resolve(movies);
      if (url === "/halls") return Promise.resolve(halls);
      if (url === "/showtimes") return Promise.resolve([]);

      return Promise.resolve({});
    });

    renderShowtimes();

    expect(
      await screen.findByText("No showtimes yet")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Add your first showtime using the form above.")
    ).toBeInTheDocument();

    expect(
      screen.getByText("0 showtimes configured")
    ).toBeInTheDocument();
  });

  it("should display an error when the initial data cannot be loaded", async () => {
    mockApi.mockImplementation((url) => {
      if (url === "/movies") {
        return Promise.reject(new Error("Failed to load showtimes."));
      }

      if (url === "/halls") return Promise.resolve(halls);
      if (url === "/showtimes") return Promise.resolve(showtimes);

      return Promise.resolve({});
    });

    renderShowtimes();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load showtimes."
    );
  });

  it("should create a new showtime successfully", async () => {
    renderShowtimes();

    await waitForShowtimes();

    fireEvent.change(screen.getByLabelText("Movie"), {
      target: { value: "movie2" },
    });

    fireEvent.change(screen.getByLabelText("Hall"), {
      target: { value: "hall2" },
    });

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-11-25" },
    });

    fireEvent.change(screen.getByLabelText("Start time"), {
      target: { value: "20:00" },
    });

    fireEvent.change(screen.getByLabelText("Price (RM)"), {
      target: { value: "20.50" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "+ Add Showtime" })
    );

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith("/showtimes", {
        method: "POST",
        body: JSON.stringify({
          movieId: "movie2",
          hallId: "hall2",
          date: "2026-11-25",
          startTime: "20:00",
          price: 20.5,
        }),
      });
    });
  });

  it("should load an existing showtime into the form for editing", async () => {
    renderShowtimes();

    await waitForShowtimes();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Edit" })[0]
    );

    expect(
      screen.getByRole("heading", { name: "Edit Showtime" })
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Movie")).toHaveValue("movie1");
    expect(screen.getByLabelText("Hall")).toHaveValue("hall1");
    expect(screen.getByLabelText("Date")).toHaveValue("2026-11-20");
    expect(screen.getByLabelText("Start time")).toHaveValue("19:30");
    expect(screen.getByLabelText("Price (RM)")).toHaveValue(18);

    expect(
      screen.getByRole("button", { name: "Save Changes" })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Cancel" })
    ).toBeInTheDocument();
  });

  it("should update an existing showtime successfully", async () => {
    renderShowtimes();

    await waitForShowtimes();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Edit" })[0]
    );

    fireEvent.change(screen.getByLabelText("Start time"), {
      target: { value: "20:30" },
    });

    fireEvent.change(screen.getByLabelText("Price (RM)"), {
      target: { value: "22.50" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Save Changes" })
    );

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith("/showtimes/showtime1", {
        method: "PUT",
        body: JSON.stringify({
          movieId: "movie1",
          hallId: "hall1",
          date: "2026-11-20",
          startTime: "20:30",
          price: 22.5,
        }),
      });
    });
  });

  it("should cancel editing and reset the form", async () => {
    renderShowtimes();

    await waitForShowtimes();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Edit" })[0]
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Cancel" })
    );

    expect(
      screen.getByRole("heading", { name: "Add New Showtime" })
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Movie")).toHaveValue("movie1");
    expect(screen.getByLabelText("Hall")).toHaveValue("hall1");
    expect(screen.getByLabelText("Date")).toHaveValue("");
    expect(screen.getByLabelText("Start time")).toHaveValue("");
    expect(screen.getByLabelText("Price (RM)")).toHaveValue(18);
  });

  it("should display an error when saving a showtime fails", async () => {
    mockApi.mockImplementation((url, options) => {
      if (url === "/movies") return Promise.resolve(movies);
      if (url === "/halls") return Promise.resolve(halls);

      if (url === "/showtimes" && options?.method === "POST") {
        return Promise.reject(new Error("Failed to save showtime."));
      }

      if (url === "/showtimes") return Promise.resolve(showtimes);

      return Promise.resolve({});
    });

    renderShowtimes();

    await waitForShowtimes();

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-11-25" },
    });

    fireEvent.change(screen.getByLabelText("Start time"), {
      target: { value: "20:00" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "+ Add Showtime" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to save showtime."
    );
  });

  it("should delete a showtime after confirmation", async () => {
    renderShowtimes();

    await waitForShowtimes();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Delete" })[0]
    );

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith("/showtimes/showtime1", {
        method: "DELETE",
      });
    });

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete this showtime?",
        message: expect.stringContaining('"Interstellar"'),
      })
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Showtime has been deleted."
    );
  });

  it("should not delete a showtime when confirmation is cancelled", async () => {
    mockConfirm.mockResolvedValue(false);

    renderShowtimes();

    await waitForShowtimes();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Delete" })[0]
    );

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Delete this showtime?" })
      );
    });

    // Let the (declined) confirmation promise settle before asserting
    await Promise.resolve();

    expect(mockApi).not.toHaveBeenCalledWith("/showtimes/showtime1", {
      method: "DELETE",
    });
  });

  it("should display an error when deleting a showtime fails", async () => {
    mockApi.mockImplementation((url, options) => {
      if (url === "/movies") return Promise.resolve(movies);
      if (url === "/halls") return Promise.resolve(halls);

      if (
        url === "/showtimes/showtime1" &&
        options?.method === "DELETE"
      ) {
        return Promise.reject(
          new Error("Failed to delete showtime.")
        );
      }

      if (url === "/showtimes") {
        return Promise.resolve(showtimes);
      }

      return Promise.resolve({});
    });

    renderShowtimes();

    await waitForShowtimes();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Delete" })[0]
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to delete showtime."
    );

    expect(mockApi).toHaveBeenCalledWith("/showtimes/showtime1", {
      method: "DELETE",
    });
  });
});