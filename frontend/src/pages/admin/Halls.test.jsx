import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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

import Halls from "./Halls.jsx";

const halls = [
  { _id: "hall1", name: "Hall 1", rows: 5, seatsPerRow: 8 },
  { _id: "hall2", name: "Hall 2", rows: 6, seatsPerRow: 10 },
];

// The page loads /halls, /showtimes and /movies on mount, so route by URL
// instead of returning the same value for every call.
function routeApi(overrides = {}) {
  return (url, options) => {
    const key = `${options?.method || "GET"} ${url}`;

    if (key in overrides) {
      const value = overrides[key];
      return typeof value === "function" ? value(url, options) : value;
    }

    if (url === "/halls") return Promise.resolve(halls);
    if (url === "/showtimes" || url === "/movies") return Promise.resolve([]);

    return Promise.resolve({});
  };
}

function mutationCalls() {
  return mockApi.mock.calls.filter(([, options]) => options?.method);
}

function renderHalls() {
  return render(<Halls />);
}

async function waitForHalls() {
  await screen.findByText("Hall 1");
}

describe("Halls Admin Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockApi.mockReset();
    mockApi.mockImplementation(routeApi());
    mockConfirm.mockReset();
    mockConfirm.mockResolvedValue(true);

    vi.stubGlobal("requestAnimationFrame", (callback) => {
      callback();
      return 1;
    });

    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should display the page heading and description", async () => {
    renderHalls();

    await waitForHalls();

    expect(screen.getByRole("heading", { name: "Halls" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Manage cinema halls, seating capacity, cleaning time, and availability status."
      )
    ).toBeInTheDocument();
  });

  it("should display the loading state initially", () => {
    mockApi.mockImplementation(() => new Promise(() => {}));

    renderHalls();

    expect(screen.getByText("Loading halls...")).toBeInTheDocument();
  });

  it("should fetch halls from the API", async () => {
    renderHalls();

    await waitForHalls();

    expect(mockApi).toHaveBeenCalledWith("/halls");
  });

  it("should display all halls and their seating details", async () => {
    renderHalls();

    await waitForHalls();

    expect(screen.getByText("Hall 1")).toBeInTheDocument();
    expect(screen.getByText("Hall 2")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("should calculate the total seats for each hall", async () => {
    renderHalls();

    await waitForHalls();

    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
  });

  it("should calculate the total cinema capacity", async () => {
    renderHalls();

    await waitForHalls();

    // The footer is a single text node that also lists current showtimes,
    // so match the part we care about instead of the whole string.
    expect(
      screen.getByText(/Total capacity: 100 seats across 2 halls/)
    ).toBeInTheDocument();
  });

  it("should display the configured hall count", async () => {
    renderHalls();

    await waitForHalls();

    expect(screen.getByText("2 halls configured")).toBeInTheDocument();
  });

  it("should display an empty state when no halls exist", async () => {
    mockApi.mockImplementation(routeApi({ "GET /halls": Promise.resolve([]) }));

    renderHalls();

    expect(await screen.findByText("No halls yet")).toBeInTheDocument();
    expect(
      screen.getByText("Add your first hall using the form above.")
    ).toBeInTheDocument();
    expect(screen.getByText("0 halls configured")).toBeInTheDocument();
  });

  it("should display an error when halls cannot be loaded", async () => {
    mockApi.mockImplementation(
      routeApi({ "GET /halls": Promise.reject(new Error("Unable to load halls.")) })
    );

    renderHalls();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load halls."
    );
  });

  it("should display the default seat preview", async () => {
    renderHalls();

    await waitForHalls();

    expect(screen.getByText("40 seats")).toBeInTheDocument();
  });

  it("should update the seat preview when the seating layout changes", async () => {
    renderHalls();

    await waitForHalls();

    fireEvent.change(screen.getByLabelText("Rows"), {
      target: { value: "6" },
    });

    fireEvent.change(screen.getByLabelText("Seats per row"), {
      target: { value: "10" },
    });

    expect(screen.getByText("60 seats")).toBeInTheDocument();
  });

  it("should reject a hall with a blank name", async () => {
    renderHalls();

    await waitForHalls();

    fireEvent.change(screen.getByLabelText("Hall name"), {
      target: { value: "   " },
    });

    fireEvent.submit(
      screen.getByRole("button", { name: "+ Add Hall" }).closest("form")
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please enter a hall name."
    );

    expect(mutationCalls()).toHaveLength(0);
  });

  it("should reject invalid seating dimensions", async () => {
    renderHalls();

    await waitForHalls();

    fireEvent.change(screen.getByLabelText("Hall name"), {
      target: { value: "Hall 3" },
    });

    fireEvent.change(screen.getByLabelText("Rows"), {
      target: { value: "0" },
    });

    fireEvent.submit(
      screen.getByRole("button", { name: "+ Add Hall" }).closest("form")
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Rows and seats per row must be whole numbers of at least 1."
    );

    expect(mutationCalls()).toHaveLength(0);
  });

  it("should reject an invalid cleaning time", async () => {
    renderHalls();

    await waitForHalls();

    fireEvent.change(screen.getByLabelText("Hall name"), {
      target: { value: "Hall 3" },
    });

    fireEvent.change(screen.getByLabelText("Cleaning time (minutes)"), {
      target: { value: "-5" },
    });

    fireEvent.submit(
      screen.getByRole("button", { name: "+ Add Hall" }).closest("form")
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cleaning time must be a whole number of 0 minutes or more."
    );

    expect(mutationCalls()).toHaveLength(0);
  });

  it("should create a new hall successfully", async () => {
    renderHalls();

    await waitForHalls();

    fireEvent.change(screen.getByLabelText("Hall name"), {
      target: { value: "Hall 3" },
    });

    fireEvent.change(screen.getByLabelText("Rows"), {
      target: { value: "4" },
    });

    fireEvent.change(screen.getByLabelText("Seats per row"), {
      target: { value: "10" },
    });

    fireEvent.change(screen.getByLabelText("Cleaning time (minutes)"), {
      target: { value: "25" },
    });

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "MAINTENANCE" },
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Add Hall" }));

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith("/halls", {
        method: "POST",
        body: JSON.stringify({
          name: "Hall 3",
          rows: 4,
          seatsPerRow: 10,
          cleaningMinutes: 25,
          status: "MAINTENANCE",
        }),
      });
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      '"Hall 3" has been added.'
    );

    expect(screen.getByLabelText("Hall name")).toHaveValue("");
  });

  it("REGRESSION: a 30-minute cleaning time is saved and shown straight after creating a hall", async () => {
    // Stateful fake backend: POST stores exactly what it receives and the
    // following GET /halls returns it, like the real API + database.
    const store = [...halls];

    mockApi.mockImplementation((url, options) => {
      if (url === "/halls" && options?.method === "POST") {
        const body = JSON.parse(options.body);
        store.push({ _id: "hall-new", ...body });
        return Promise.resolve(store[store.length - 1]);
      }
      if (url === "/halls") return Promise.resolve([...store]);
      if (url === "/showtimes" || url === "/movies") return Promise.resolve([]);
      return Promise.resolve({});
    });

    renderHalls();
    await waitForHalls();

    fireEvent.change(screen.getByLabelText("Hall name"), {
      target: { value: "Hall 30" },
    });
    fireEvent.change(screen.getByLabelText("Cleaning time (minutes)"), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ Add Hall" }));

    const row = (await screen.findByText("Hall 30")).closest("tr");
    expect(row).toHaveTextContent("30 min");
    expect(row).not.toHaveTextContent("20 min");

    expect(JSON.parse(mockApi.mock.calls.find(([, o]) => o?.method === "POST")[1].body))
      .toMatchObject({ cleaningMinutes: 30 });
  });

  it("should reject a cleaning time above the 30-minute limit", async () => {
    renderHalls();
    await waitForHalls();

    fireEvent.change(screen.getByLabelText("Hall name"), {
      target: { value: "Hall 4" },
    });
    fireEvent.change(screen.getByLabelText("Cleaning time (minutes)"), {
      target: { value: "45" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "+ Add Hall" }).closest("form")
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cleaning time cannot be more than 30 minutes."
    );
    expect(mutationCalls()).toHaveLength(0);
  });

  it("should use the default cleaning time and status when creating a hall", async () => {
    renderHalls();

    await waitForHalls();

    fireEvent.change(screen.getByLabelText("Hall name"), {
      target: { value: "Hall 4" },
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Add Hall" }));

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith("/halls", {
        method: "POST",
        body: JSON.stringify({
          name: "Hall 4",
          rows: 5,
          seatsPerRow: 8,
          cleaningMinutes: 20,
          status: "ACTIVE",
        }),
      });
    });
  });

  it("should load the selected hall into the form for editing", async () => {
    renderHalls();

    await waitForHalls();

    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    fireEvent.click(editButtons[0]);

    expect(
      screen.getByRole("heading", { name: "Edit Hall" })
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Hall name")).toHaveValue("Hall 1");
    expect(screen.getByLabelText("Rows")).toHaveValue(5);
    expect(screen.getByLabelText("Seats per row")).toHaveValue(8);
    // Halls without these fields fall back to the defaults
    expect(screen.getByLabelText("Cleaning time (minutes)")).toHaveValue(20);
    expect(screen.getByLabelText("Status")).toHaveValue("ACTIVE");
    expect(
      screen.getByRole("button", { name: "Save Changes" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("should update an existing hall successfully", async () => {
    renderHalls();

    await waitForHalls();

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    fireEvent.change(screen.getByLabelText("Hall name"), {
      target: { value: "Premium Hall" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith("/halls/hall1", {
        method: "PUT",
        body: JSON.stringify({
          name: "Premium Hall",
          rows: 5,
          seatsPerRow: 8,
          cleaningMinutes: 20,
          status: "ACTIVE",
        }),
      });
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      '"Premium Hall" has been updated.'
    );
  });

  it("should cancel editing and reset the form", async () => {
    renderHalls();

    await waitForHalls();

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByRole("heading", { name: "Add New Hall" })
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Hall name")).toHaveValue("");
    expect(screen.getByLabelText("Rows")).toHaveValue(5);
    expect(screen.getByLabelText("Seats per row")).toHaveValue(8);
  });

  it("should display an error when saving a hall fails", async () => {
    mockApi.mockImplementation(
      routeApi({
        "POST /halls": () => Promise.reject(new Error("Unable to save the hall.")),
      })
    );

    renderHalls();

    await waitForHalls();

    fireEvent.change(screen.getByLabelText("Hall name"), {
      target: { value: "Hall 3" },
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Add Hall" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to save the hall."
    );
  });

  it("should delete a hall after confirmation", async () => {
    mockConfirm.mockResolvedValue(true);

    renderHalls();

    await waitForHalls();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith("/halls/hall1", {
        method: "DELETE",
      });
    });

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete this hall?",
        message: expect.stringContaining('"Hall 1"'),
      })
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      '"Hall 1" has been deleted.'
    );
  });

  it("should not delete a hall when confirmation is cancelled", async () => {
    mockConfirm.mockResolvedValue(false);

    renderHalls();

    await waitForHalls();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());

    // Let the (declined) confirmation promise settle before asserting
    await Promise.resolve();

    expect(mutationCalls()).toHaveLength(0);
  });

  it("should display an error when deleting a hall fails", async () => {
    mockConfirm.mockResolvedValue(true);

    mockApi.mockImplementation(
      routeApi({
        "DELETE /halls/hall1": () =>
          Promise.reject(new Error("Unable to delete the hall.")),
      })
    );

    renderHalls();

    await waitForHalls();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to delete the hall."
    );
  });
});