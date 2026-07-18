import { z } from "zod";
import { WakeReportSchema, type WakeReport } from "@inception/domain";
import { WakeReportValidationError } from "./types";

export { WakeReportValidationError } from "./types";

export class WakeReportParser {
  parse(input: unknown): WakeReport {
    try {
      if (typeof input === "string") {
        const trimmed = input.trim();
        const withoutFence = trimmed
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/, "");
        return WakeReportSchema.parse(JSON.parse(withoutFence));
      }
      return WakeReportSchema.parse(input);
    } catch (cause) {
      if (cause instanceof z.ZodError) {
        throw new WakeReportValidationError(
          cause.issues.slice(0, 5).map((issue) => ({
            path: issue.path.length ? issue.path.map(String).join(".") : "root",
            code: issue.code
          }))
        );
      }
      throw new WakeReportValidationError([{ path: "root", code: "invalid_json" }]);
    }
  }
}
