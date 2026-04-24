import type { Config } from "@ccflare/config";
import type { DatabaseOperations } from "@ccflare/database";
import { Logger } from "@ccflare/logger";

export interface ExhaustionAlertDeps {
	config: Pick<
		Config,
		| "getExhaustionAlertEnabled"
		| "getExhaustionAlertUrl"
		| "getExhaustionAlertToken"
	>;
	dbOps: Pick<DatabaseOperations, "countAccountAvailability">;
	fetchImpl?: typeof fetch;
	intervalMs?: number;
	setIntervalImpl?: typeof setInterval;
	clearIntervalImpl?: typeof clearInterval;
	logger?: Pick<Logger, "info" | "warn" | "error">;
}

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Starts a lightweight poller that fires a single webhook POST when every
 * non-paused account is simultaneously rate-limited (no account available to
 * route to). Fires once on the false→true transition; the in-memory flag
 * resets when at least one account becomes available again. No recovery ping.
 *
 * Returns a stop function. If the feature is disabled or no URL is configured,
 * the poller is not started and the stop function is a no-op.
 */
export function startExhaustionAlertPoller(
	deps: ExhaustionAlertDeps,
): () => void {
	const {
		config,
		dbOps,
		fetchImpl = fetch,
		intervalMs = DEFAULT_INTERVAL_MS,
		setIntervalImpl = setInterval,
		clearIntervalImpl = clearInterval,
		logger = new Logger("ExhaustionAlert"),
	} = deps;

	if (!config.getExhaustionAlertEnabled()) {
		return () => {};
	}

	const url = config.getExhaustionAlertUrl();
	if (!url) {
		logger.warn(
			"enable_exhaustion_alert=true but exhaustion_alert_ntfy_url is empty; poller not started",
		);
		return () => {};
	}

	let lastAlertState = false;

	const tick = async () => {
		try {
			const { total, available } = dbOps.countAccountAvailability();
			const exhausted = total > 0 && available === 0;

			if (exhausted && !lastAlertState) {
				const token = config.getExhaustionAlertToken();
				await postAlert(fetchImpl, url, token, total, logger);
				lastAlertState = true;
			} else if (!exhausted && lastAlertState) {
				lastAlertState = false;
				logger.info("Exhaustion cleared (at least one account available)");
			}
		} catch (err) {
			logger.error(`Poller tick failed: ${err}`);
		}
	};

	const handle = setIntervalImpl(() => {
		void tick();
	}, intervalMs);

	logger.info(
		`Exhaustion-alert poller started (interval=${intervalMs}ms, url=${redact(url)})`,
	);

	return () => {
		clearIntervalImpl(handle as unknown as Parameters<typeof clearInterval>[0]);
	};
}

async function postAlert(
	fetchImpl: typeof fetch,
	url: string,
	token: string | null,
	total: number,
	logger: Pick<Logger, "info" | "warn" | "error">,
): Promise<void> {
	const body = {
		event: "ccflare.exhaustion",
		message: `All ${total} non-paused account(s) rate-limited — proxy has no available account`,
		accounts_total: total,
		accounts_available: 0,
		ts: new Date().toISOString(),
	};

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	try {
		const res = await fetchImpl(url, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
		});
		if (!res.ok) {
			logger.warn(
				`Alert POST returned ${res.status} ${res.statusText} (url=${redact(url)})`,
			);
			return;
		}
		logger.info(`Exhaustion alert fired (accounts=${total})`);
	} catch (err) {
		logger.error(`Alert POST failed: ${err}`);
	}
}

function redact(url: string): string {
	try {
		const u = new URL(url);
		return `${u.protocol}//${u.host}${u.pathname}`;
	} catch {
		return "<invalid-url>";
	}
}
