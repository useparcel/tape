import { has, cloneDeep, pick, isPlainObject } from "lodash";
import { Diagnostic } from "./types";

interface DiagnosticError extends Error {
  diagnostic?: Diagnostic;
}

/**
 * Returns a diagnostic reporter
 */
export function generateReporter() {
  let diagnostics = [];

  /**
   * diagnostic = {
   *   type               Enum(error | warning | info)
   *   source             String - Plugin source
   *   message            String - General explanation of the error
   *   path               String - The file path
   *   loc.start.line     Number - the 1-indexed line of the start of the problem
   *   loc.start.column   Number - the 1-indexed column of the start of the problem
   *   loc.end.line       Number - the 1-indexed line of the end of the problem
   *   loc.end.column     Number - the 1-indexed column of the end of the problem
   *   fix                String - the string to replace the given location to fix the problem
   * }
   */
  function report(diagnostic: Diagnostic) {
    diagnostic = pick(
      {
        type: "error",
        source: "internal",
        message: "An unknown error occurred.",
        path: null,
        ...diagnostic,
      },
      [
        "type",
        "source",
        "message",
        "path",
        "loc.start.line",
        "loc.start.column",
        "loc.end.line",
        "loca.end.column",
        "fix",
      ]
    );

    /**
     * Clean up bad location data
     */
    if (
      diagnostic.loc &&
      (!isPlainObject(diagnostic.loc) ||
        !(
          has(diagnostic, "loc.start.line") &&
          has(diagnostic, "loc.start.column")
        ))
    ) {
      delete diagnostic.loc;
    }

    /**
     * Clean up bad diagonstic type
     */
    if (!["error", "warning", "info"].includes(diagnostic.type)) {
      diagnostic.type = "error";
    }

    if (diagnostic.type === "error") {
      const error: DiagnosticError = new Error(diagnostic.message);
      error.diagnostic = diagnostic;

      throw error;
    }

    diagnostics.push(diagnostic);
  }

  report.release = () => diagnostics;

  return addReportContext(report, {});
}

/**
 * Adds parts the diagnostic to all future report
 */
export function addReportContext(
  report: ((diagnostic: Diagnostic) => void) & {
    error?: (diagnostic: Diagnostic) => void;
    warning?: (diagnostic: Diagnostic) => void;
    info?: (diagnostic: Diagnostic) => void;
    release: () => Diagnostic[];
  },
  context: Partial<Diagnostic>
) {
  const newReport = function (diagnostic: Diagnostic) {
    return report({ ...diagnostic, ...context });
  };

  newReport.error = (diagnostic: Diagnostic) =>
    newReport({ ...diagnostic, type: "error" });
  newReport.warning = (diagnostic: Diagnostic) =>
    newReport({ ...diagnostic, type: "warning" });
  newReport.info = (diagnostic: Diagnostic) =>
    newReport({ ...diagnostic, type: "info" });

  newReport.release = report.release;

  return newReport;
}
