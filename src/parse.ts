import { err, ok, type Result } from "neverthrow";
import { z } from "zod";

export const recommendOptionsSchema = z.object({
  bet: z.coerce.number().positive(),
  hand: z.string().min(1),
  dealer: z.string().min(1),
  cashout: z.coerce.number().nonnegative().optional(),
  rules: z.enum(["s17", "h17"]).optional(),
  strategy: z.string().min(1).optional(),
  json: z.boolean().optional().default(false),
});

export type RecommendOptions = z.infer<typeof recommendOptionsSchema>;

/** Validates raw commander option values into a typed options object. */
export function parseOptions(raw: unknown): Result<RecommendOptions, string> {
  const parsed = recommendOptionsSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const details = parsed.error.issues
    .map((issue) =>
      issue.path.length ? `--${issue.path.join(".")}: ${issue.message}` : issue.message,
    )
    .join("; ");
  return err(`Invalid options: ${details}`);
}
