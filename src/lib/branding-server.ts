import "server-only";
import { cache } from "react";
import { convexClient } from "./db/client";
import { api } from "../../convex/_generated/api";
export const getBranding = cache(async () => (await convexClient()).query(api.branding.current, {}));
