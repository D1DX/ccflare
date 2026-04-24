import { describe, expect, it } from "bun:test";
import { startExhaustionAlertPoller } from "./exhaustion-alert";

type Counts = { total: number; available: number };

function makeDeps(opts: {
	enabled: boolean;
	url: string | null;
	countsQueue: Counts[];
	fetchResponses?: Response[];
	fetchErrors?: Error[];
}) {
	const counts = [...opts.countsQueue];
	const fetchResponses = [...(opts.fetchResponses ?? [])];
	const fetchErrors = [...(opts.fetchErrors ?? [])];
	const calls: Array<{ url: string; body: unknown }> = [];
	let lastHandler: (() => void) | null = null;

	const logSink = {
		info: (_: string) => {},
		warn: (_: string) => {},
		error: (_: string) => {},
	};

	const deps = {
		config: {
			getExhaustionAlertEnabled: () => opts.enabled,
			getExhaustionAlertUrl: () => opts.url,
		},
		dbOps: {
			countAccountAvailability: (): Counts => {
				return counts.shift() ?? { total: 0, available: 0 };
			},
		},
		fetchImpl: (async (url: string, init?: RequestInit) => {
			calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
			const err = fetchErrors.shift();
			if (err) throw err;
			return fetchResponses.shift() ?? new Response(null, { status: 200 });
		}) as unknown as typeof fetch,
		intervalMs: 10,
		setIntervalImpl: ((handler: () => void) => {
			lastHandler = handler;
			return 1 as unknown as ReturnType<typeof setInterval>;
		}) as typeof setInterval,
		clearIntervalImpl: ((_: unknown) => {}) as typeof clearInterval,
		logger: logSink,
	};

	return {
		deps,
		calls,
		trigger: async () => {
			if (!lastHandler) return;
			lastHandler();
			// allow the async tick microtasks to settle
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
		},
		wasStarted: () => lastHandler !== null,
	};
}

describe("startExhaustionAlertPoller", () => {
	it("does not start when disabled", () => {
		const { deps, wasStarted } = makeDeps({
			enabled: false,
			url: "https://ntfy.example/d1dx-claude",
			countsQueue: [],
		});
		const stop = startExhaustionAlertPoller(deps);
		expect(wasStarted()).toBe(false);
		stop();
	});

	it("does not start when URL is missing", () => {
		const { deps, wasStarted } = makeDeps({
			enabled: true,
			url: null,
			countsQueue: [],
		});
		const stop = startExhaustionAlertPoller(deps);
		expect(wasStarted()).toBe(false);
		stop();
	});

	it("fires exactly once on false→true transition", async () => {
		const { deps, calls, trigger } = makeDeps({
			enabled: true,
			url: "https://ntfy.example/d1dx-claude",
			countsQueue: [
				{ total: 3, available: 1 }, // healthy
				{ total: 3, available: 0 }, // exhausted → fire
				{ total: 3, available: 0 }, // still exhausted → no refire
				{ total: 3, available: 0 }, // still exhausted → no refire
			],
		});
		const stop = startExhaustionAlertPoller(deps);
		await trigger();
		await trigger();
		await trigger();
		await trigger();
		expect(calls.length).toBe(1);
		expect(calls[0].url).toBe("https://ntfy.example/d1dx-claude");
		stop();
	});

	it("re-arms after recovery (false→true→false→true fires twice)", async () => {
		const { deps, calls, trigger } = makeDeps({
			enabled: true,
			url: "https://ntfy.example/d1dx-claude",
			countsQueue: [
				{ total: 3, available: 0 }, // exhausted → fire #1
				{ total: 3, available: 2 }, // recovered → reset flag
				{ total: 3, available: 0 }, // exhausted again → fire #2
			],
		});
		const stop = startExhaustionAlertPoller(deps);
		await trigger();
		await trigger();
		await trigger();
		expect(calls.length).toBe(2);
		stop();
	});

	it("does not fire when total=0 (no accounts configured)", async () => {
		const { deps, calls, trigger } = makeDeps({
			enabled: true,
			url: "https://ntfy.example/d1dx-claude",
			countsQueue: [
				{ total: 0, available: 0 },
				{ total: 0, available: 0 },
			],
		});
		const stop = startExhaustionAlertPoller(deps);
		await trigger();
		await trigger();
		expect(calls.length).toBe(0);
		stop();
	});

	it("survives fetch errors without unhandled rejection", async () => {
		const { deps, calls, trigger } = makeDeps({
			enabled: true,
			url: "https://ntfy.example/d1dx-claude",
			countsQueue: [
				{ total: 3, available: 0 }, // triggers POST that throws
				{ total: 3, available: 0 }, // still exhausted; flag was set → no refire
			],
			fetchErrors: [new Error("network down")],
		});
		const stop = startExhaustionAlertPoller(deps);
		await trigger();
		await trigger();
		// one attempted POST; the error path logs + the flag still flipped
		expect(calls.length).toBe(1);
		stop();
	});
});
