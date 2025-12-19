/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import type { NodeSchema } from "../core/index.js";
import type { EncodedSchema } from "../serialization/index.js";
import type { ISchemaStorage, ISchemaPersistence, StorageResult } from "../storage/index.js";

/**
 * Simple in-memory storage for testing.
 *
 * @remarks
 * This class provides a basic implementation of {@link ISchemaStorage} that stores
 * all values in memory using a `Map`. It always returns values directly (never
 * nested storage), making it suitable for testing flat data structures.
 *
 * @example
 * ```typescript
 * const storage = new MockStorage();
 * storage.setField("name", nameSchema, "Alice");
 *
 * const result = storage.getField("name", nameSchema);
 * if (result?.type === "value") {
 *   console.log(result.value); // "Alice"
 * }
 * ```
 */
export class MockStorage implements ISchemaStorage {
	private readonly data = new Map<string, unknown>();

	/**
	 * Get a field value from mock storage.
	 * MockStorage always returns values directly, never nested storage.
	 */
	public getField(key: string, fieldSchema: NodeSchema): StorageResult | undefined {
		const value = this.data.get(key);
		if (value === undefined && !this.data.has(key)) {
			return undefined;
		}
		return { type: "value", value };
	}

	/**
	 * {@inheritDoc ISchemaStorage.setField}
	 */
	public setField(key: string, fieldSchema: NodeSchema, value: unknown): void {
		this.data.set(key, value);
	}

	/**
	 * {@inheritDoc ISchemaStorage.deleteField}
	 */
	public deleteField(key: string): boolean {
		return this.data.delete(key);
	}

	/**
	 * {@inheritDoc ISchemaStorage.hasField}
	 */
	public hasField(key: string): boolean {
		return this.data.has(key);
	}

	/**
	 * {@inheritDoc ISchemaStorage.keys}
	 */
	public keys(): IterableIterator<string> {
		return this.data.keys();
	}

	/**
	 * {@inheritDoc ISchemaStorage.size}
	 */
	public get size(): number {
		return this.data.size;
	}

	/**
	 * Get a copy of the raw data for testing purposes.
	 *
	 * @returns A new Map containing all stored key-value pairs
	 */
	public getRawData(): Map<string, unknown> {
		return new Map(this.data);
	}
}

/**
 * Simple in-memory schema persistence for testing.
 *
 * @remarks
 * This class provides a basic implementation of {@link ISchemaPersistence} that
 * stores the schema in memory. It enforces the constraint that
 * {@link ISchemaPersistence.setPersistedSchema} can only be called once.
 *
 * @example
 * ```typescript
 * const persistence = new MockPersistence();
 *
 * // First call succeeds
 * persistence.setPersistedSchema(encodedSchema);
 *
 * // Second call throws
 * persistence.setPersistedSchema(anotherSchema); // Error!
 *
 * // Use upgrade instead
 * persistence.upgradePersistedSchema(upgradedSchema);
 * ```
 */
export class MockPersistence implements ISchemaPersistence {
	private schema: EncodedSchema | undefined;

	/**
	 * {@inheritDoc ISchemaPersistence.getPersistedSchema}
	 */
	public getPersistedSchema(): EncodedSchema | undefined {
		return this.schema;
	}

	/**
	 * {@inheritDoc ISchemaPersistence.setPersistedSchema}
	 */
	public setPersistedSchema(schema: EncodedSchema): void {
		if (this.schema !== undefined) {
			throw new Error("Cannot initialize - schema already stored");
		}
		this.schema = schema;
	}

	/**
	 * {@inheritDoc ISchemaPersistence.upgradePersistedSchema}
	 */
	public upgradePersistedSchema(schema: EncodedSchema): void {
		this.schema = schema;
	}
}
