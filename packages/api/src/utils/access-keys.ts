/**
 * Access key generation and hashing for ccflare's per-user auth feature.
 * Keys are formatted as `ccfk_<64-char-hex>` and stored as SHA-256 hashes.
 */

export async function hashAccessKey(key: string): Promise<string> {
	const data = new TextEncoder().encode(key);
	const buf = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export async function generateAccessKey(): Promise<{
	key: string;
	hash: string;
}> {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	const hex = Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	const key = `ccfk_${hex}`;
	const hash = await hashAccessKey(key);
	return { key, hash };
}
