import { describe, it, expect } from "vitest";
import { CRON_PRESETS, presetFromCron, cronFromPreset } from "./cron-presets";

describe("cron-presets", () => {
  it("round-trips off: cronFromPreset(presetFromCron(null)) === null", () => {
    const cron = null;
    expect(cronFromPreset(presetFromCron(cron))).toBe(cron);
  });

  it("round-trips hourly: cronFromPreset(presetFromCron(cron)) === cron", () => {
    const cron = "0 * * * *";
    expect(cronFromPreset(presetFromCron(cron))).toBe(cron);
  });

  it("round-trips every6h: cronFromPreset(presetFromCron(cron)) === cron", () => {
    const cron = "0 */6 * * *";
    expect(cronFromPreset(presetFromCron(cron))).toBe(cron);
  });

  it("round-trips daily03: cronFromPreset(presetFromCron(cron)) === cron", () => {
    const cron = "0 3 * * *";
    expect(cronFromPreset(presetFromCron(cron))).toBe(cron);
  });

  it("round-trips weeklySun03: cronFromPreset(presetFromCron(cron)) === cron", () => {
    const cron = "0 3 * * 0";
    expect(cronFromPreset(presetFromCron(cron))).toBe(cron);
  });

  it("presetFromCron with invalid cron returns 'off' (fallback)", () => {
    expect(presetFromCron("invalid")).toBe("off");
  });

  it("presetFromCron with null returns 'off'", () => {
    expect(presetFromCron(null)).toBe("off");
  });
});
