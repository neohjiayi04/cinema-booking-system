import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import UserProfile from "./UserProfile.jsx";

const { mockApi, mockUpdateUser, mockLogout, mockUseAuth } = vi.hoisted(
  () => ({
    mockApi: vi.fn(),
    mockUpdateUser: vi.fn(),
    mockLogout: vi.fn(),
    mockUseAuth: vi.fn()
  })
);

vi.mock("../services/api.js", () => ({
  api: mockApi
}));

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: mockUseAuth
}));

const sampleUser = {
  _id: "user-1",
  name: "John Tan",
  email: "john@example.com",
  role: "customer"
};

const renderUserProfile = (user = sampleUser) => {
  mockUseAuth.mockReturnValue({
    user,
    updateUser: mockUpdateUser,
    logout: mockLogout
  });

  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/" element={<h1>Movies Page</h1>} />
        <Route path="/my-bookings" element={<h1>My Bookings Page</h1>} />
        <Route path="/login" element={<h1>Login Page</h1>} />
      </Routes>
    </MemoryRouter>
  );
};

describe("UserProfile Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockApi.mockResolvedValue({
      user: {
        ...sampleUser,
        name: "John Tan",
        email: "john@example.com"
      }
    });

    mockUseAuth.mockReturnValue({
      user: sampleUser,
      updateUser: mockUpdateUser,
      logout: mockLogout
    });
  });

  it("should display the profile page heading", () => {
    renderUserProfile();

    expect(
      screen.getByRole("heading", { name: "My Profile" })
    ).toBeInTheDocument();
  });

  it("should display the user's existing name and email", () => {
    renderUserProfile();

    expect(screen.getByDisplayValue("John Tan")).toBeInTheDocument();
    expect(screen.getByDisplayValue("john@example.com")).toBeInTheDocument();
  });

  it("should display the user's initials in the profile avatar", () => {
    renderUserProfile();

    expect(screen.getByText("JT")).toBeInTheDocument();
  });

  it("should generate initials using the first two name parts", () => {
    renderUserProfile({
      ...sampleUser,
      name: "John Michael Tan"
    });

    expect(screen.getByText("JM")).toBeInTheDocument();
  });

  it("should display the Cinema Member role for customers", () => {
    renderUserProfile();

    expect(screen.getByText("Cinema Member")).toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument();
  });

  it("should display the Administrator role for admins", () => {
    renderUserProfile({
      ...sampleUser,
      name: "Admin User",
      role: "admin"
    });

    expect(screen.getAllByText("Administrator")).toHaveLength(2);
  });

  it("should display the personal information and security sections", () => {
    renderUserProfile();

    expect(
      screen.getByRole("heading", { name: "Personal Information" })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Account Security" })
    ).toBeInTheDocument();

    expect(screen.getByText("Protected")).toBeInTheDocument();
  });

  it("should display navigation links to Movies and My Bookings", () => {
    renderUserProfile();

    expect(screen.getByRole("link", { name: /Browse Movies/ })).toHaveAttribute(
      "href",
      "/"
    );

    expect(screen.getByRole("link", { name: /My Bookings/ })).toHaveAttribute(
      "href",
      "/my-bookings"
    );
  });

  it("should update the user's profile successfully", async () => {
    const updatedUser = {
      ...sampleUser,
      name: "Jane Tan",
      email: "jane@example.com"
    };

    mockApi.mockResolvedValue({
      user: updatedUser
    });

    renderUserProfile();

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "Jane Tan" }
    });

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "jane@example.com" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith("/auth/me", {
        method: "PUT",
        body: JSON.stringify({
          name: "Jane Tan",
          email: "jane@example.com"
        })
      });
    });

    expect(mockUpdateUser).toHaveBeenCalledWith(updatedUser);

    expect(
      await screen.findByRole("status")
    ).toHaveTextContent("Your profile has been updated successfully.");

    expect(screen.getByDisplayValue("Jane Tan")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("jane@example.com")
    ).toBeInTheDocument();
  });

  it("should trim whitespace before submitting profile details", async () => {
    renderUserProfile();

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "  Jane Tan  " }
    });

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "  jane@example.com  " }
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith("/auth/me", {
        method: "PUT",
        body: JSON.stringify({
          name: "Jane Tan",
          email: "jane@example.com"
        })
      });
    });
  });

  it("should display a validation error when the name is empty", () => {
    renderUserProfile();

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "   " }
    });

    fireEvent.submit(screen.getByRole("button", { name: "Save Changes" }).closest("form"));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please enter your name and email address."
    );

    expect(mockApi).not.toHaveBeenCalled();
  });

  it("should display a validation error when the email is empty", () => {
    renderUserProfile();

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "   " }
    });

    fireEvent.submit(screen.getByRole("button", { name: "Save Changes" }).closest("form"));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please enter your name and email address."
    );

    expect(mockApi).not.toHaveBeenCalled();
  });

  it("should display an error when the profile update fails", async () => {
    mockApi.mockRejectedValue(new Error("Email address is already registered."));

    renderUserProfile();

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Email address is already registered.");

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("should display a fallback error message when the update error has no message", async () => {
    mockApi.mockRejectedValue({});

    renderUserProfile();

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Unable to update your profile.");
  });

  it("should reset edited fields to the original user details", () => {
    renderUserProfile();

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "Jane Tan" }
    });

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "jane@example.com" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByDisplayValue("John Tan")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("john@example.com")
    ).toBeInTheDocument();
  });

  it("should clear existing error and success messages when Reset is clicked", async () => {
    mockApi.mockRejectedValue(new Error("Update failed."));

    renderUserProfile();

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Update failed."
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("should log out and navigate to the login page", async () => {
    renderUserProfile();

    fireEvent.click(screen.getByRole("button", { name: /Log Out/ }));

    expect(mockLogout).toHaveBeenCalledTimes(1);

    expect(
      await screen.findByRole("heading", { name: "Login Page" })
    ).toBeInTheDocument();
  });

  it("should render nothing when no user is authenticated", () => {
    const { container } = renderUserProfile(null);

    expect(container).toBeEmptyDOMElement();
  });

  it("should enforce the maximum length of the name and email fields", () => {
    renderUserProfile();

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