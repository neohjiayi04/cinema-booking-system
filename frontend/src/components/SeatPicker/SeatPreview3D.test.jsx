import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SeatPreview3D, { PreviewSwitch } from "./SeatPreview3D.jsx";

vi.mock("./SeatView3D.jsx", () => ({ default: ({ focusSeat }) => <div data-testid="seat-view-3d">{focusSeat.label}</div> }));

const seats = [];
for (const row of ["A", "B"]) for (let n = 1; n <= 4; n++) seats.push({ _id: `${row}0${n}`, row, number: n, price: 20, status: "available" });

describe("SeatPreview3D", () => {
  it("asks for a seat before anything is picked", () => {
    render(<SeatPreview3D seats={seats} selected={[]} />);
    expect(screen.getByText(/Hover or pick a seat/)).toBeTruthy();
    expect(screen.queryByTestId("seat-view-3d")).toBeNull();
  });

  it("shows the view from the newest picked seat", async () => {
    render(<SeatPreview3D seats={seats} selected={["A01", "B03"]} />);
    expect((await screen.findByTestId("seat-view-3d")).textContent).toBe("B3");
    expect(screen.getByText("Row B, Seat 3")).toBeTruthy();
  });

  it("lets the customer look from another picked seat, until the selection changes", async () => {
    const { rerender } = render(<SeatPreview3D seats={seats} selected={["A01", "B03"]} />);
    await screen.findByTestId("seat-view-3d");
    fireEvent.click(screen.getByRole("button", { name: "A1" }));
    expect(screen.getByText("Row A, Seat 1")).toBeTruthy();
    rerender(<SeatPreview3D seats={seats} selected={["A01", "B03", "B04"]} />);
    expect(screen.getByText("Row B, Seat 4")).toBeTruthy();
  });

  it("previews a hovered seat, then goes back to the picked seat", async () => {
    const { rerender } = render(<SeatPreview3D seats={seats} selected={["A01"]} />);
    await screen.findByTestId("seat-view-3d");
    rerender(<SeatPreview3D seats={seats} selected={["A01"]} hoverId="B04" />);
    expect(screen.getByText("Row B, Seat 4")).toBeTruthy();
    expect(screen.getByText("Hover preview")).toBeTruthy();
    rerender(<SeatPreview3D seats={seats} selected={["A01"]} hoverId={null} />);
    expect(screen.getByText("Row A, Seat 1")).toBeTruthy();
    expect(screen.queryByText("Hover preview")).toBeNull();
  });

  it("previews a hovered seat before anything is picked, and ignores unknown ids", async () => {
    const { rerender } = render(<SeatPreview3D seats={seats} selected={[]} hoverId="A02" />);
    expect(await screen.findByText("Row A, Seat 2")).toBeTruthy();
    rerender(<SeatPreview3D seats={seats} selected={[]} hoverId="Z99" />);
    expect(screen.getByText(/Hover or pick a seat/)).toBeTruthy();
  });

  it("switch reports its new state", () => {
    const onChange = vi.fn();
    render(<PreviewSwitch checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch", { name: /3D seat preview/ }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});