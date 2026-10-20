import { useEffect, useState } from "react";
import { reportClientError } from "@/lib/client-error/report";

/**
 * Reports the error that stopped a page (src/lib/client-error/report.ts) and
 * says whether that error is on record, so an error page claims a report
 * only once there is one. False in development and tests, which send none.
 */
export function useErrorReport(error: Error): boolean {
  // Keyed by its error: a new error starts unreported, without a reset.
  const [record, setRecord] = useState<{
    error: Error;
    onRecord: boolean;
  } | null>(null);

  useEffect(() => {
    let current = true;
    void reportClientError(error).then((onRecord) => {
      if (current) setRecord({ error, onRecord });
    });
    return () => {
      current = false;
    };
  }, [error]);

  return record?.error === error && record.onRecord;
}
