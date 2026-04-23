import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { generateAccessKey } from "@ccflare/api";
import { Config } from "@ccflare/config";
import {
	DatabaseOperations,
	ensureSchema,
	runMigrations,
} from "@ccflare/database";
import { createAccessKeyGuard } from "./access-key-middleware";

function makeDbOps(): DatabaseOperations {
	// Use in-memory SQLite via the DatabaseOperations constructor
	// (it accepts a path, so we use ":memory:")
	const dbOps = new DatabaseOperations(":memory:");
	// Defensive: ensure the schema matches latest migrations
	const db = dbOps.getDatabase();
	ensureSchema(db);
	runMigrations(db);
	return dbOps;
}

function makeConfig(requireKeys: boolean): Config {
	// Use a one-off path for the config file so tests don't touch the real one
	const tmp = `/tmp/ccflare-test-config-${Date.now()}-${Math.random()}.json`;
	const config = new Config(tmp);
	config.setRequireAccessKeys(requireKeys);
	return config;
}

describe("access key guard", () => {
	let dbOps: DatabaseOperations;

	beforeEach(() => {
		dbOps = makeDbOps();
	});

	it("returns null when feature is disabled (passthrough)", async () => {
		const guard = createAccessKeyGuard(dbOps, makeConfig(false));
		const req = new Request("https://example.com/v1/messages");
		expect(await guard(req)).toBeNull();
	});

	it("returns 401 when no key is present", async () => {
		const guard = createAccessKeyGuard(dbOps, makeConfig(true));
		const req = new Request("https://example.com/v1/messages");
		const result = await guard(req);
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(401);
	});

	it("returns 401 for an unknown key", async () => {
		const guard = createAccessKeyGuard(dbOps, makeConfig(true));
		const req = new Request("https://example.com/v1/messages", {
			headers: { authorization: "Bearer ccfk_unknown_key_value" },
		});
		const result = await guard(req);
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(401);
	});

	it("accepts key via Authorization: Bearer and tags request", async () => {
		const { key, hash } = await generateAccessKey();
		const user = dbOps.createUser("alice", hash);
		const guard = createAccessKeyGuard(dbOps, makeConfig(true));

		const req = new Request("https://example.com/v1/messages", {
			headers: { authorization: `Bearer ${key}` },
		});
		const result = await guard(req);
		expect(result).toBeInstanceOf(Request);
		expect((result as Request).headers.get("x-ccflare-user-id")).toBe(user.id);
	});

	it("accepts key via x-api-key and tags request", async () => {
		const { key, hash } = await generateAccessKey();
		const user = dbOps.createUser("bob", hash);
		const guard = createAccessKeyGuard(dbOps, makeConfig(true));

		const req = new Request("https://example.com/v1/messages", {
			headers: { "x-api-key": key },
		});
		const result = await guard(req);
		expect(result).toBeInstanceOf(Request);
		expect((result as Request).headers.get("x-ccflare-user-id")).toBe(user.id);
	});

	it("ignores non-ccfk_ Authorization tokens", async () => {
		const guard = createAccessKeyGuard(dbOps, makeConfig(true));
		const req = new Request("https://example.com/v1/messages", {
			headers: { authorization: "Bearer sk-random-oauth-token" },
		});
		const result = await guard(req);
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(401);
	});
});
