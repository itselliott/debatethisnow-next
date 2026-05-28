import { describe, expect, it } from "vitest";
import { ALLOWED_SETTINGS } from "@/lib/services/settings-service";

describe("ALLOWED_SETTINGS whitelist", () => {
  it("declares the documented 7 keys", () => {
    expect(Object.keys(ALLOWED_SETTINGS).sort()).toEqual(
      [
        "email_digest",
        "locale",
        "profanity_filter",
        "profile_public",
        "push_enabled",
        "reduce_motion",
        "sound_enabled",
      ].sort(),
    );
  });

  it("each key has type + default + description", () => {
    for (const [k, spec] of Object.entries(ALLOWED_SETTINGS)) {
      expect(spec.type, `${k}.type`).toBeDefined();
      expect(spec.description, `${k}.description`).toBeTruthy();
      expect("default" in spec, `${k}.default`).toBe(true);
    }
  });

  it("locale's enum allows null + 'en' + 'es'", () => {
    const spec = ALLOWED_SETTINGS.locale!;
    expect(spec.enum).toContain("en");
    expect(spec.enum).toContain("es");
    expect(spec.enum).toContain(null);
  });
});
