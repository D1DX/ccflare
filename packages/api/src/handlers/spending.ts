import type { DatabaseOperations } from "@ccflare/database";
import { BadRequest, errorResponse, jsonResponse } from "@ccflare/http";
import { isTimeRange, type TimeRange } from "@ccflare/types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const TIME_RANGE_MS: Record<TimeRange, number> = {
	"1h": HOUR_MS,
	"6h": 6 * HOUR_MS,
	"24h": DAY_MS,
	"7d": 7 * DAY_MS,
	"30d": 30 * DAY_MS,
};

/**
 * GET /api/analytics/by-user?range=<TimeRange>
 *
 * Returns spending grouped by user across the given time window. Rows
 * without a user_id (pre-Phase-2 requests or requests made while
 * require_access_keys was off) are excluded — the card is a per-user
 * attribution view, not a "unattributed bucket" view.
 */
export function createSpendingByUserHandler(dbOps: DatabaseOperations) {
	return (params: URLSearchParams): Response => {
		const rangeParam = params.get("range") ?? "24h";
		if (!isTimeRange(rangeParam)) {
			return errorResponse(BadRequest(`Unsupported range '${rangeParam}'`));
		}
		const sinceMs = Date.now() - TIME_RANGE_MS[rangeParam];
		const rows = dbOps.getCostByUser(sinceMs);
		return jsonResponse({
			range: rangeParam,
			users: rows,
		});
	};
}
