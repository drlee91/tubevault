import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import * as useStorageUsageModule from "@/lib/client/use-storage-usage";
import { StorageUsageDisplay } from "./storage-usage-display";

describe("StorageUsageDisplay", () => {
  it("shows skeleton while loading", () => {
    vi.spyOn(useStorageUsageModule, "useStorageUsage").mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useStorageUsageModule.useStorageUsage>);

    render(<StorageUsageDisplay />);
    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });

  it("renders Audio and Video rows with formatted bytes", () => {
    vi.spyOn(useStorageUsageModule, "useStorageUsage").mockReturnValue({
      data: {
        audio: { totalBytes: 1048576, fileCount: 12 },
        video: { totalBytes: 2097152, fileCount: 5 },
      },
      isLoading: false,
    } as ReturnType<typeof useStorageUsageModule.useStorageUsage>);

    render(<StorageUsageDisplay />);
    expect(screen.getByText("Audio")).toBeInTheDocument();
    expect(screen.getByText("Video")).toBeInTheDocument();
    // 1048576 bytes = 1.0 MB
    expect(screen.getByText(/1\.0 MB/)).toBeInTheDocument();
    // 2097152 bytes = 2.0 MB
    expect(screen.getByText(/2\.0 MB/)).toBeInTheDocument();
    expect(screen.getByText(/12 files/)).toBeInTheDocument();
    expect(screen.getByText(/5 files/)).toBeInTheDocument();
  });
});
