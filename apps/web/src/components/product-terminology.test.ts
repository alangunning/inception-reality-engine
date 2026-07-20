import { describe, expect, it } from "vitest";
import {
  canonicalProductCopy,
  canonicalProductValue,
  productEventLabel,
  realityDisplayName
} from "./product-terminology";

describe("product terminology", () => {
  it("leaves current product terms unchanged", () => {
    expect(canonicalProductCopy("Reality formed.")).toBe("Reality formed.");
    expect(canonicalProductCopy("Totem Check sealed Memory."))
      .toBe("Totem Check sealed Memory.");
    expect(canonicalProductCopy("Adversarial Subject entered."))
      .toBe("Adversarial Subject entered.");
    expect(canonicalProductCopy("Reality stabilised.")).toBe("Reality stabilised.");
  });

  it("presents Wake lifecycle event types as Memory lifecycle events", () => {
    expect(productEventLabel("wake.sealing")).toBe("memory / sealing");
    expect(productEventLabel("wake.returning", "Totem Check")).toBe("Totem Check");
  });

  it("normalises live model spelling to the product stabilisation language", () => {
    expect(canonicalProductCopy("Reality not stabilized.")).toBe("Reality not stabilised.");
    expect(canonicalProductCopy("STABILIZATION BLOCKED")).toBe("STABILISATION BLOCKED");
    expect(canonicalProductCopy("Stabilize Reality")).toBe("Stabilise Reality");
  });

  it("normalises live spelling inside nested event detail values", () => {
    expect(canonicalProductValue({
      report: {
        summary: "Reality was stabilized."
      }
    })).toEqual({
      report: {
        summary: "Reality was stabilised."
      }
    });
  });

  it("uses the persisted current Reality name without legacy aliases", () => {
    expect(realityDisplayName({ name: "Reality" })).toBe("Reality");
    expect(realityDisplayName({ name: "VAmPI Ownership Review" }))
      .toBe("VAmPI Ownership Review");
    expect(realityDisplayName({ name: "Under coordinated attack" }))
      .toBe("Under coordinated attack");
  });
});
