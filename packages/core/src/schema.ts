export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) => StandardResult<Output> | Promise<StandardResult<Output>>;
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
  };
}

export type StandardResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<{ readonly message: string; readonly path?: ReadonlyArray<unknown> | undefined }> };

/** Phantom type carrier: `t<{ text: string }>()` types a payload with zero runtime validation. */
export interface Type<T> {
  readonly __phantom?: T;
}

export function t<T>(): Type<T> {
  return {};
}

export type PayloadType<T> = StandardSchemaV1<any, T> | Type<T>;

export function isSchema(v: unknown): v is StandardSchemaV1 {
  return typeof v === "object" && v !== null && "~standard" in v;
}

/**
 * Validate synchronously against a payload spec. Phantom types always pass. Async schemas are
 * rejected — validation sits on the dispatch hot path.
 */
export function validate(spec: PayloadType<unknown> | undefined, value: unknown): { ok: true } | { ok: false; message: string } {
  if (!spec || !isSchema(spec)) return { ok: true };
  const result = spec["~standard"].validate(value);
  if (result instanceof Promise) return { ok: false, message: "async validation unsupported" };
  if (result.issues) {
    return { ok: false, message: result.issues.map((i) => i.message).join("; ") || "invalid payload" };
  }
  return { ok: true };
}
