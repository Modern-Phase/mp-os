import { useAuth } from "@clerk/clerk-react";
import { useCallback } from "react";

/**
 * JWT template name that Clerk uses for Convex. Must match the template
 * created in Clerk Dashboard and applicationID in convex/auth.config.ts.
 */
const CONVEX_JWT_TEMPLATE = "convex" as const;

/**
 * Returns a function that fetches the Convex JWT. Use this whenever you make
 * custom HTTP requests to Convex (e.g. fetch to convex.site endpoints).
 * Using the default getToken() would send a token with the wrong audience
 * and Convex would reject it with "No auth provider found".
 *
 * @example
 * const getConvexToken = useConvexAuthToken();
 * const token = await getConvexToken();
 * fetch(url, { headers: { Authorization: token ? `Bearer ${token}` : "" } });
 */
export function useConvexAuthToken(): () => Promise<string | null> {
  const { getToken } = useAuth();

  return useCallback(() => {
    return getToken({ template: CONVEX_JWT_TEMPLATE });
  }, [getToken]);
}
