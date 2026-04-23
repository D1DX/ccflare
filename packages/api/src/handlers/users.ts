import type { DatabaseOperations } from "@ccflare/database";
import {
	BadRequest,
	errorResponse,
	jsonResponse,
	NotFound,
} from "@ccflare/http";
import { Logger } from "@ccflare/logger";
import { generateAccessKey } from "../utils/access-keys";
import { parseJsonObject } from "../utils/json";

const log = new Logger("UsersHandler");

export function createUsersListHandler(dbOps: DatabaseOperations) {
	return (): Response => {
		const users = dbOps.getAllUsers().map((u) => ({
			id: u.id,
			name: u.name,
			createdAt: new Date(u.createdAt).toISOString(),
		}));
		return jsonResponse(users);
	};
}

export function createUserAddHandler(dbOps: DatabaseOperations) {
	return async (req: Request): Promise<Response> => {
		const body = await parseJsonObject(req);
		const name = body?.name;
		if (typeof name !== "string" || !name.trim()) {
			return errorResponse(BadRequest("Field 'name' is required"));
		}

		const { key, hash } = await generateAccessKey();
		const user = dbOps.createUser(name.trim(), hash);
		log.info(`Created user '${user.name}' (${user.id})`);

		return jsonResponse(
			{
				id: user.id,
				name: user.name,
				key,
				createdAt: new Date(user.createdAt).toISOString(),
			},
			201,
		);
	};
}

export function createUserDeleteHandler(dbOps: DatabaseOperations) {
	return (_req: Request, userId: string): Response => {
		const deleted = dbOps.deleteUser(userId);
		if (!deleted) {
			return errorResponse(NotFound(`User '${userId}' not found`));
		}
		log.info(`Deleted user ${userId}`);
		return jsonResponse({ deleted: true });
	};
}
