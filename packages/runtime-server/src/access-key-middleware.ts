import { hashAccessKey } from "@ccflare/api";
import type { Config } from "@ccflare/config";
import type { DatabaseOperations } from "@ccflare/database";
import { Logger } from "@ccflare/logger";

const log = new Logger("AccessKeyMiddleware");

/**
 * Returns a guard function for the /v1/* proxy path.
 *
 * Return value semantics:
 *   Response  — reject with this (401)
 *   Request   — tagged request with x-ccflare-user-id header injected; proceed
 *   null      — feature disabled; proceed with original request
 */
export function createAccessKeyGuard(
	dbOps: DatabaseOperations,
	config: Config,
): (req: Request) => Promise<Response | Request | null> {
	return async (req: Request): Promise<Response | Request | null> => {
		if (!config.getRequireAccessKeys()) {
			return null;
		}

		let key: string | null = null;

		const auth = req.headers.get("authorization");
		if (auth?.startsWith("Bearer ccfk_")) {
			key = auth.slice("Bearer ".length);
		}

		if (!key) {
			const xApiKey = req.headers.get("x-api-key");
			if (xApiKey?.startsWith("ccfk_")) {
				key = xApiKey;
			}
		}

		if (!key) {
			log.warn("Rejected: no access key");
			return new Response(
				JSON.stringify({
					error: "Unauthorized",
					message: "Access key required",
				}),
				{ status: 401, headers: { "Content-Type": "application/json" } },
			);
		}

		const hash = await hashAccessKey(key);
		const user = dbOps.findUserByKeyHash(hash);

		if (!user) {
			log.warn("Rejected: invalid access key");
			return new Response(
				JSON.stringify({
					error: "Unauthorized",
					message: "Invalid access key",
				}),
				{ status: 401, headers: { "Content-Type": "application/json" } },
			);
		}

		// Inject user id as internal header for downstream logging.
		// x-ccflare-user-id is stripped before forwarding to Anthropic
		// by deleteTransportHeaders in packages/providers/src/base.ts.
		const headers = new Headers(req.headers);
		headers.set("x-ccflare-user-id", user.id);
		return new Request(req, { headers });
	};
}
