export function fieldError<T extends object>(
  fields: T | undefined,
  name: keyof T & string,
): string | undefined {
  if (!fields || !(name in fields)) return undefined;

  const field = fields[name as keyof T];
  if (!field) return undefined;
  if (Array.isArray(field)) return (field[0] as { message?: string } | undefined)?.message;
  return (field as { message?: string }).message;
}

type ClerkApiError = { errors?: { longMessage?: string; message?: string }[] };

/** Message from a Clerk API error (Core 3 `{ error }` returns or thrown legacy errors). */
export function clerkErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err && typeof err === "object" && "errors" in err) {
    const first = (err as ClerkApiError).errors?.[0];
    if (first?.longMessage ?? first?.message) return first.longMessage ?? first.message!;
  }
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
