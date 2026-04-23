import { describe, expect, it } from "bun:test";
import { generateAccessKey, hashAccessKey } from "./access-keys";

describe("access keys", () => {
	it("generates a key with ccfk_ prefix and 64 hex chars", async () => {
		const { key } = await generateAccessKey();
		expect(key).toMatch(/^ccfk_[0-9a-f]{64}$/);
	});

	it("hash matches the raw key's SHA-256", async () => {
		const { key, hash } = await generateAccessKey();
		const recomputed = await hashAccessKey(key);
		expect(hash).toBe(recomputed);
	});

	it("each call produces a unique key", async () => {
		const a = await generateAccessKey();
		const b = await generateAccessKey();
		expect(a.key).not.toBe(b.key);
		expect(a.hash).not.toBe(b.hash);
	});

	it("hashAccessKey is deterministic", async () => {
		const h1 = await hashAccessKey("ccfk_deadbeef");
		const h2 = await hashAccessKey("ccfk_deadbeef");
		expect(h1).toBe(h2);
		expect(h1).toMatch(/^[0-9a-f]{64}$/);
	});
});
