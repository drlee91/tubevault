import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaylistsTabs } from "./playlists-tabs";

const replace = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParamsValue,
}));

describe("PlaylistsTabs", () => {
  beforeEach(() => {
    replace.mockClear();
    searchParamsValue = new URLSearchParams();
  });

  it("defaults to playlists tab when no tab param", () => {
    render(
      <PlaylistsTabs
        playlists={<div data-testid="pl">Playlists content</div>}
        standalone={<div data-testid="sa">Standalone content</div>}
      />
    );

    const playlistsTab = screen.getByRole("tab", { name: /playlists/i });
    expect(playlistsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("pl")).toBeInTheDocument();
    expect(screen.queryByTestId("sa")).not.toBeInTheDocument();
  });

  it("shows standalone tab when ?tab=standalone", () => {
    searchParamsValue = new URLSearchParams("tab=standalone");
    render(
      <PlaylistsTabs
        playlists={<div data-testid="pl">Playlists content</div>}
        standalone={<div data-testid="sa">Standalone content</div>}
      />
    );

    const standaloneTab = screen.getByRole("tab", { name: /standalone/i });
    expect(standaloneTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("sa")).toBeInTheDocument();
    expect(screen.queryByTestId("pl")).not.toBeInTheDocument();
  });

  it("calls router.replace with tab=standalone when Standalone tab is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PlaylistsTabs
        playlists={<div data-testid="pl">Playlists content</div>}
        standalone={<div data-testid="sa">Standalone content</div>}
      />
    );

    await user.click(screen.getByRole("tab", { name: /standalone/i }));

    expect(replace).toHaveBeenCalledWith("/playlists?tab=standalone");
  });
});
