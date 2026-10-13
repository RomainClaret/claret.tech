/**
 * The dashboard's status colours: the text of a metric or score, and the
 * tint of its card. -700 on the light theme and -400 on the dark one: the
 * -500 text the dashboard used read at 1.7 to 2.3:1 on its light cards,
 * under the 3:1 its large values need (status-colors.test.ts measures
 * every one in both themes). Here, under src/components, so Tailwind sees
 * the classes.
 */
export const STATUS_TEXT: Record<string, string> = {
  excellent: "text-green-700 dark:text-green-400",
  good: "text-blue-700 dark:text-blue-400",
  fair: "text-yellow-700 dark:text-yellow-400",
  poor: "text-red-700 dark:text-red-400",
  unknown: "text-gray-600 dark:text-gray-400",
};

export const STATUS_BG: Record<string, string> = {
  excellent: "bg-green-500/10",
  good: "bg-blue-500/10",
  fair: "bg-yellow-500/10",
  poor: "bg-red-500/10",
  unknown: "bg-gray-500/10",
};
