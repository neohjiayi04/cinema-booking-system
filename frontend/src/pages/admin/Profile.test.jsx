import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdminProfile from "./Profile.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { api } from "../../services/api.js";

const mockNavigate = vi.fn();
const mockLogout = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../services/api.js", () => ({
  api: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

import { useNavigate } from "react-router-dom";

const mockUser = {
  _id: "admin123",
  name: "Jane Mary Smith",
  email: "jane@example.com",
  role: "admin",
};

function renderProfile() {
  return render(
    <MemoryRouter>
      <AdminProfile />
    </MemoryRouter>
  );
}

function setupAuth(user = mockUser) {
  useAuth.mockReturnValue({
    user,
    updateUser: mockUpdateUser,
    logout: mockLogout,
  });
}

describe("AdminProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    setupAuth();

    useNavigate.mockReturnValue(mockNavigate);
  });

  it("renders the administrator profile information", () => {
    renderProfile();

    expect(screen.getByRole("heading", {
      name: "Jane Mary Smith",
    })).toBeInTheDocument();

    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("Administrator")).toHaveLength(2);
    expect(screen.getByText("Personal Information")).toBeInTheDocument();
    expect(screen.getByText("Account Security")).toBeInTheDocument();
    expect(screen.getByText("Protected")).toBeInTheDocument();
  });

  it("displays the correct initials for the administrator", () => {
    renderProfile();

    expect(screen.getByText("JM")).toBeInTheDocument();
  });

  it("uses the first letter when the administrator has no name", () => {
    setupAuth({
      ...mockUser,
      name: "",
    });

    renderProfile();

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders nothing when no user is authenticated", () => {
    setupAuth(null);

    const { container } = renderProfile();

    expect(container.firstChild).toBeNull();
  });

  it("initializes the form with the current user details", () => {
    renderProfile();

    expect(screen.getByLabelText("Full Name")).toHaveValue(
      "Jane Mary Smith"
    );

    expect(screen.getByLabelText("Email Address")).toHaveValue(
      "jane@example.com"
    );
  });

  it("updates the profile successfully", async () => {
    const user = userEvent.setup();

    const updatedUser = {
      ...mockUser,
      name: "Jane Tan",
      email: "jane.tan@example.com",
    };

    api.mockResolvedValue({
      user: updatedUser,
    });

    renderProfile();

    await user.clear(screen.getByLabelText("Full Name"));
    await user.type(screen.getByLabelText("Full Name"), "  Jane Tan  ");

    await user.clear(screen.getByLabelText("Email Address"));
    await user.type(
      screen.getByLabelText("Email Address"),
      "  jane.tan@example.com  "
    );

    await user.click(
      screen.getByRole("button", { name: "Save Changes" })
    );

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith("/auth/me", {
        method: "PUT",
        body: JSON.stringify({
          name: "Jane Tan",
          email: "jane.tan@example.com",
        }),
      });
    });

    expect(mockUpdateUser).toHaveBeenCalledWith(updatedUser);

    expect(screen.getByLabelText("Full Name")).toHaveValue("Jane Tan");
    expect(screen.getByLabelText("Email Address")).toHaveValue(
      "jane.tan@example.com"
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Your profile has been updated successfully."
    );
  });

  it("shows a validation error when the name contains only whitespace", async () => {
    const user = userEvent.setup();

    renderProfile();

    await user.clear(screen.getByLabelText("Full Name"));
    await user.type(screen.getByLabelText("Full Name"), "   ");

    await user.click(
      screen.getByRole("button", { name: "Save Changes" })
    );

    expect(
      screen.getByRole("alert")
    ).toHaveTextContent(
      "Please enter your name and email address."
    );

    expect(api).not.toHaveBeenCalled();
  });

  it("does not submit when the email field is empty", async () => {
    const user = userEvent.setup();

    renderProfile();

    await user.clear(screen.getByLabelText("Email Address"));

    await user.click(
      screen.getByRole("button", { name: "Save Changes" })
    );

    expect(api).not.toHaveBeenCalled();
  });

  it("shows the API error message when the update fails", async () => {
    const user = userEvent.setup();

    api.mockRejectedValue(new Error("Email address already exists."));

    renderProfile();

    await user.click(
      screen.getByRole("button", { name: "Save Changes" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email address already exists."
    );

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("shows a fallback error when the API error has no message", async () => {
    const user = userEvent.setup();

    api.mockRejectedValue({});

    renderProfile();

    await user.click(
      screen.getByRole("button", { name: "Save Changes" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to update your profile."
    );
  });

  it("resets the form to the current user details", async () => {
    const user = userEvent.setup();

    renderProfile();

    await user.clear(screen.getByLabelText("Full Name"));
    await user.type(screen.getByLabelText("Full Name"), "Changed Name");

    await user.clear(screen.getByLabelText("Email Address"));
    await user.type(
      screen.getByLabelText("Email Address"),
      "changed@example.com"
    );

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByLabelText("Full Name")).toHaveValue(
      "Jane Mary Smith"
    );

    expect(screen.getByLabelText("Email Address")).toHaveValue(
      "jane@example.com"
    );
  });

  it("clears existing error and success messages when resetting", async () => {
    const user = userEvent.setup();

    api.mockRejectedValue(new Error("Update failed."));

    renderProfile();

    await user.click(
      screen.getByRole("button", { name: "Save Changes" })
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("disables the save button while the update is in progress", async () => {
    const user = userEvent.setup();

    let resolveRequest;

    api.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    renderProfile();

    await user.click(
      screen.getByRole("button", { name: "Save Changes" })
    );

    expect(
      screen.getByRole("button", { name: "Saving..." })
    ).toBeDisabled();

    resolveRequest({
      user: mockUser,
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Save Changes" })
      ).toBeEnabled();
    });
  });

  it("logs out and redirects to the login page", async () => {
    const user = userEvent.setup();

    renderProfile();

    await user.click(screen.getByRole("button", { name: /log out/i }));

    expect(mockLogout).toHaveBeenCalledTimes(1);

    expect(mockNavigate).toHaveBeenCalledWith("/login", {
      replace: true,
    });
  });

  it("sets the maximum allowed lengths for the input fields", () => {
    renderProfile();

    expect(screen.getByLabelText("Full Name")).toHaveAttribute(
      "maxLength",
      "100"
    );

    expect(screen.getByLabelText("Email Address")).toHaveAttribute(
      "maxLength",
      "254"
    );
  });
});
