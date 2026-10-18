export function getDatabaseErrorCode(error: unknown): string | undefined {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('driverError' in error)
  ) {
    return undefined;
  }

  const driverError = error.driverError;
  if (
    typeof driverError !== 'object' ||
    driverError === null ||
    !('code' in driverError)
  ) {
    return undefined;
  }

  return typeof driverError.code === 'string' ? driverError.code : undefined;
}
