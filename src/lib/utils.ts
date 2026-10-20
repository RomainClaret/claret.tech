import { type ClassValue, clsx } from "clsx";
import { reportConflicts } from "./cn-conflicts";

/**
 * Joins class names as written (clsx). Two classes in one call that set the
 * same thing would both reach the page, so none are written
 * (cn-conflicts.test.ts), and outside production reportConflicts names any
 * that come from props. tailwind-merge, which settled them, stays out of
 * the page's JavaScript.
 */
export function cn(...inputs: ClassValue[]) {
  const classes = clsx(inputs);
  if (process.env.NODE_ENV !== "production") reportConflicts(classes);
  return classes;
}
