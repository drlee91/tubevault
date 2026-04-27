export type ActionError = { code: string; message: string; field?: string };
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T> { return { ok: true, data }; }
export function fail(code: string, message: string, field?: string): ActionResult<never> {
  return { ok: false, error: { code, message, field } };
}
