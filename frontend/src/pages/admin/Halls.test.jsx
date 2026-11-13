import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { mockApi } = vi.hoisted(() => ({
  mockApi: vi.fn(),
}));

vi.mock("../../services/api.js", () => ({
  api: mockApi,
}));

import Halls from "./Halls.jsx";

const halls = [
  { _id: "hall1", name: "Hall 1", rows: 5, seatsPerRow: 8 },
  { _id: "hall2", name: "Hall 2", rows: 6, seatsPerRow: 10 },
];

function renderHalls() {
  return render(<Halls />);
}

async function waitForHalls() {
  await screen.findByText("Hall 1");
}

describe("Halls Admin Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockApi.mockResolvedValue(halls);

    vi.stubGlobal("requestAnimationFrame", (callback) => {
      callback();
      return 1;
    });

    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should display the page heading and description", () => {
    renderHalls();

    expect(screen.getByRole("heading", { name: "Halls" })).toBeInTheDocument();
    expect(
      screen.getByText("Manage and view all cinema halls.")
    ).toBeInTheDocument();
  });

  it("should display the loading state initially", () => {
    mockApi.mockReturnValue(new Promise(() => {}));

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

    expect(
      screen.getByText("Total capacity: 100 seats across 2 halls")
    ).toBeInTheDocument();
  });

  it("should display the configured hall count", async () => {
    renderHalls();

    await waitForHalls();

    expect(screen.getByText("2 halls configured")).toBeInTheDocument();
  });

  it("should display an empty state when no halls exist", async () => {
    mockApi.mockResolvedValue([]);

    renderHalls();

    expect(await screen.findByText("No halls yet")).toBeInTheDocument();
    expect(
      screen.getByText("Add your first hall using the form above.")
    ).toBeInTheDocument();
    expect(screen.getByText("0 halls configured")).toBeInTheDocument();
  });

  it("should display an error when halls cannot be loaded", async () => {
    mockApi.mockRejectedValue(new Error("Unable to load halls."));

    renderHalls();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load halls."
    );
  });

  it("should display the default seat preview", () => {
    renderHalls();

    expect(screen.getByText("40 seats")).toBeInTheDocument();
  });

  it("should update the seat preview when the seating layout changes", () => {
    renderHalls();

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

    fireEvent.submit(screen.getByRole("button", { name: "+ Add Hall" }).closest("form"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please enter a hall name."
    );

    expect(mockApi).toHaveBeenCalledTimes(1);
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

    fireEvent.submit(screen.getByRole("button", { name: "+ Add Hall" }).closest("form"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Rows and seats per row must be whole numbers of at least 1."
    );

    expect(mockApi).toHaveBeenCalledTimes(1);
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

    fireEvent.click(screen.getByRole("button", { name: "+ Add Hall" }));

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith("/halls", {
        method: "POST",
        body: JSON.stringify({
          name: "Hall 3",
          rows: 4,
          seatsPerRow: 10,
        }),
      });
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      '"Hall 3" has been added.'
    );

    expect(screen.getByLabelText("Hall name")).toHaveValue("");
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
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
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
    mockApi.mockImplementation((url, options) => {
      if (options?.method === "POST") {
        return Promise.reject(new Error("Unable to save the hall."));
      }

      return Promise.resolve(halls);
    });

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
    vi.stubGlobal("confirm", vi.fn(() => true));

    renderHalls();

    await waitForHalls();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith("/halls/hall1", {
        method: "DELETE",
      });
    });

    expect(confirm).toHaveBeenCalledWith(
      'Delete "Hall 1"? This cannot be undone.'
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      '"Hall 1" has been deleted.'
    );
  });

  it("should not delete a hall when confirmation is cancelled", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));

    renderHalls();

    await waitForHalls();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    expect(confirm).toHaveBeenCalled();
    expect(mockApi).toHaveBeenCalledTimes(1);
  });

  it("should display an error when deleting a hall fails", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));

    mockApi.mockImplementation((url, options) => {
      if (options?.method === "DELETE") {
        return Promise.reject(new Error("Unable to delete the hall."));
      }

      return Promise.resolve(halls);
    });

    renderHalls();

    await waitForHalls();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to delete the hall."
    );
  });
});
