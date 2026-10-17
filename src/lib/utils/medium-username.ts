/**
 * The Medium account the blog section reads: NEXT_PUBLIC_MEDIUM_USERNAME
 * (the deploy passes the MEDIUM_USERNAME secret as it), else romainclaret.
 * Medium's URLs carry their own "@", and the old .env.example asked for one
 * in the variable too, so a leading "@" is dropped rather than doubled.
 * scripts/extract-medium-colors.js reads it the same way, before the build.
 */
export function mediumUsername(
  value = process.env.NEXT_PUBLIC_MEDIUM_USERNAME,
): string {
  return value?.trim().replace(/^@+/, "") || "romainclaret";
}
