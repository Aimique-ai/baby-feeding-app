import axios from "axios";

export function httpStatus(err: unknown): number | null {
  if (axios.isAxiosError(err)) return err.response?.status ?? null;
  return null;
}

export function httpErrorBody<T = unknown>(err: unknown): T | null {
  if (axios.isAxiosError(err)) return (err.response?.data ?? null) as T | null;
  return null;
}
