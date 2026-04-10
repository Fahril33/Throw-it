export function logInfo(message: string) {
  // eslint-disable-next-line no-console
  console.log(message);
}

export function logWarn(message: string) {
  // eslint-disable-next-line no-console
  console.warn(message);
}

export function logError(message: string, error?: unknown) {
  // eslint-disable-next-line no-console
  console.error(message);
  if (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }/*  */
}
