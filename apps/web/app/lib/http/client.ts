import axios, { type AxiosInstance } from "axios";
import { ACTIVE_BABY_HEADER, TZ_HEADER } from "@leon/schemas/headers";
import { getBrowserTz } from "~/lib/time/browserTz";
import {
  clearActiveBabyId,
  readActiveBabyId,
  writeActiveBabyId,
} from "~/lib/baby/active";

const ECHO_HEADER = "x-active-baby-id";

function makeClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? "",
    withCredentials: false,
  });

  instance.interceptors.request.use((config) => {
    config.headers.set(TZ_HEADER, getBrowserTz());
    const activeId = readActiveBabyId();
    if (activeId) config.headers.set(ACTIVE_BABY_HEADER, activeId);
    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      const echoed =
        response.headers["x-active-baby-id"] ??
        response.headers[ECHO_HEADER.toLowerCase()];
      if (typeof echoed === "string" && /^[a-fA-F0-9]{24}$/.test(echoed)) {
        // Only write when different — avoids a feedback loop of notify→re-render→re-request.
        if (readActiveBabyId() !== echoed) writeActiveBabyId(echoed);
      }
      return response;
    },
    (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 410) {
        clearActiveBabyId();
      }
      return Promise.reject(error);
    },
  );

  return instance;
}

export const http = makeClient();
