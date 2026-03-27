export const STRATEGY_EXIT_CODES = {
  SUCCESS: 0,
  INVALID_ARGUMENTS_OR_VALIDATION: 2,
  NOT_FOUND: 3,
  PARSE_OR_COMPILE_FAILURE: 4,
  INTERNAL: 10,
} as const;

export type StrategyExitCode =
  (typeof STRATEGY_EXIT_CODES)[keyof typeof STRATEGY_EXIT_CODES];

export interface StrategyCommandErrorShape {
  code: string;
  message: string;
  data?: Record<string, unknown>;
}

export class StrategyCommandError extends Error {
  readonly code: string;
  readonly exitCode: StrategyExitCode;
  readonly data?: Record<string, unknown>;
  readonly diagnostic?: string;

  constructor(params: {
    code: string;
    message: string;
    exitCode: StrategyExitCode;
    data?: Record<string, unknown>;
    diagnostic?: string;
  }) {
    super(params.message);
    this.name = "StrategyCommandError";
    this.code = params.code;
    this.exitCode = params.exitCode;
    this.data = params.data;
    this.diagnostic = params.diagnostic;
  }
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function toSerializableError(err: unknown): StrategyCommandErrorShape {
  if (err instanceof StrategyCommandError) {
    return {
      code: err.code,
      message: err.message,
      ...(err.data ? { data: err.data } : {}),
    };
  }
  if (err instanceof Error) {
    return {
      code: "internal_error",
      message: "Unexpected internal error.",
      data: { cause: err.message },
    };
  }
  return {
    code: "internal_error",
    message: "Unexpected internal error.",
    data: { cause: String(err) },
  };
}

export function invalidArgs(
  code: string,
  message: string,
  data?: Record<string, unknown>,
): StrategyCommandError {
  return new StrategyCommandError({
    code,
    message,
    exitCode: STRATEGY_EXIT_CODES.INVALID_ARGUMENTS_OR_VALIDATION,
    data,
  });
}

export function notFound(
  code: string,
  message: string,
  data?: Record<string, unknown>,
): StrategyCommandError {
  return new StrategyCommandError({
    code,
    message,
    exitCode: STRATEGY_EXIT_CODES.NOT_FOUND,
    data,
  });
}

export function parseOrCompileFailure(
  code: string,
  message: string,
  data?: Record<string, unknown>,
): StrategyCommandError {
  return new StrategyCommandError({
    code,
    message,
    exitCode: STRATEGY_EXIT_CODES.PARSE_OR_COMPILE_FAILURE,
    data,
  });
}

export function internalError(
  code: string,
  message: string,
  data?: Record<string, unknown>,
  diagnostic?: string,
): StrategyCommandError {
  return new StrategyCommandError({
    code,
    message,
    exitCode: STRATEGY_EXIT_CODES.INTERNAL,
    data,
    diagnostic,
  });
}

export function emitStrategySuccess(result: unknown, warnings: unknown[] = []): void {
  process.exitCode = STRATEGY_EXIT_CODES.SUCCESS;
  writeJson({
    ok: true,
    result,
    warnings,
  });
}

export function emitStrategyError(err: unknown): void {
  const shaped = toSerializableError(err);
  const exitCode =
    err instanceof StrategyCommandError
      ? err.exitCode
      : STRATEGY_EXIT_CODES.INTERNAL;

  process.exitCode = exitCode;
  writeJson({
    ok: false,
    error: shaped,
  });

  if (err instanceof StrategyCommandError && err.diagnostic) {
    process.stderr.write(`${err.diagnostic}\n`);
  }
}

export async function runStrategyAction(
  action: () => Promise<unknown>,
): Promise<void> {
  try {
    const result = await action();
    emitStrategySuccess(result);
  } catch (err) {
    emitStrategyError(err);
  }
}

