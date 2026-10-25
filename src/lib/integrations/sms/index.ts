import "server-only";
import { smsProvider } from "../config";
import { consoleProvider } from "./console";
import { createMobizonProvider } from "./mobizon";
import type { SmsProvider } from "./types";

export function getSmsProvider(): SmsProvider {
  if (smsProvider === "mobizon" && process.env.MOBIZON_API_KEY) {
    return createMobizonProvider(process.env.MOBIZON_API_KEY);
  }
  return consoleProvider;
}
