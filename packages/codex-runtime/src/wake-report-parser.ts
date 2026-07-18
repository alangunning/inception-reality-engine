import { WakeReportSchema, type WakeReport } from "@inception/domain";

export class WakeReportParser {
  parse(input: unknown): WakeReport {
    if (typeof input === "string") {
      const trimmed = input.trim();
      const withoutFence = trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
      return WakeReportSchema.parse(JSON.parse(withoutFence));
    }
    return WakeReportSchema.parse(input);
  }
}
