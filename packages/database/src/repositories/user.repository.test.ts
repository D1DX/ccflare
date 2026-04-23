import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { ensureSchema } from "../migrations";
import { UserRepository } from "./user.repository";

function setupDb(): Database {
	const db = new Database(":memory:");
	ensureSchema(db);
	return db;
}

describe("UserRepository", () => {
	let db: Database;
	let users: UserRepository;

	beforeEach(() => {
		db = setupDb();
		users = new UserRepository(db);
	});

	it("creates a user and finds it by key hash", () => {
		const created = users.create("alice", "hash_alice");
		expect(created.name).toBe("alice");
		expect(created.access_key_hash).toBe("hash_alice");
		expect(typeof created.id).toBe("string");

		const found = users.findByKeyHash("hash_alice");
		expect(found?.id).toBe(created.id);
	});

	it("returns null for unknown hash", () => {
		expect(users.findByKeyHash("nope")).toBeNull();
	});

	it("lists all users", () => {
		users.create("alice", "hash_alice");
		users.create("bob", "hash_bob");
		const all = users.findAll();
		expect(all).toHaveLength(2);
		expect(all.map((u) => u.name).sort()).toEqual(["alice", "bob"]);
	});

	it("enforces unique name", () => {
		users.create("alice", "hash_alice");
		expect(() => users.create("alice", "hash_alice_2")).toThrow();
	});

	it("enforces unique key hash", () => {
		users.create("alice", "hash_shared");
		expect(() => users.create("bob", "hash_shared")).toThrow();
	});

	it("deletes a user", () => {
		const user = users.create("alice", "hash_alice");
		expect(users.delete(user.id)).toBe(true);
		expect(users.findByKeyHash("hash_alice")).toBeNull();
	});

	it("returns false when deleting a missing user", () => {
		expect(users.delete("nonexistent")).toBe(false);
	});
});
