import { type User, type UserRow, toUser } from "../models/user-row";
import { BaseRepository } from "./base.repository";

export class UserRepository extends BaseRepository<User> {
	findAll(): User[] {
		return this.query<UserRow>(
			`SELECT id, name, access_key_hash, created_at FROM users`,
		).map(toUser);
	}

	findByKeyHash(hash: string): User | null {
		const row = this.get<UserRow>(
			`SELECT id, name, access_key_hash, created_at FROM users WHERE access_key_hash = ?`,
			[hash],
		);
		return row ? toUser(row) : null;
	}

	create(name: string, keyHash: string): User {
		const id = crypto.randomUUID();
		const createdAt = Date.now();
		this.run(
			`INSERT INTO users (id, name, access_key_hash, created_at) VALUES (?, ?, ?, ?)`,
			[id, name, keyHash, createdAt],
		);
		return this.findByKeyHash(keyHash) as User;
	}

	delete(id: string): boolean {
		return this.runWithChanges(`DELETE FROM users WHERE id = ?`, [id]) > 0;
	}
}
