/**
 * Backwards-compatible entry point.
 *
 * The request pipeline now lives in `@/lib/apiClient`, which also understands
 * content types, redirects and transport failures. This file stays so existing
 * imports keep resolving.
 */
export {
  fetchWithRetry,
  apiJson,
  parseJson,
  friendlyError,
  isSessionExpired,
  RateLimitedError,
  SessionExpiredError,
  ApiError,
  NetworkError,
} from "@/lib/apiClient";
