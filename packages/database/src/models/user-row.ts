export interface UserRow {
	id: string;
	name: string;
	access_key_hash: string;
	created_at: number;
}

export interface User {
	id: string;
	name: string;
	access_key_hash: string;
	createdAt: number;
}

export function toUser(row: UserRow): User {
	return {
		id: row.id,
		name: row.name,
		access_key_hash: row.access_key_hash,
		createdAt: row.created_at,
	};
}
