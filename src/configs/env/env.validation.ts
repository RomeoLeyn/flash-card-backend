export interface ValidatedEnvConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  EXPIRES_IN: string;
  GROQ_API_KEY: string;
  FRONTEND_URL?: string;
}

export function validateEnvironment(
  rawEnv: Record<string, string | undefined>,
): ValidatedEnvConfig {
  const errors: string[] = [];

  const nodeEnv = rawEnv.NODE_ENV ?? 'development';
  const portValue = rawEnv.PORT ?? '3000';
  const port = Number(portValue);

  if (rawEnv.PORT && (!Number.isInteger(port) || port < 1 || port > 65535)) {
    errors.push('PORT must be an integer between 1 and 65535');
  }

  const databaseUrl = rawEnv.DATABASE_URL?.trim();
  if (!databaseUrl) {
    errors.push('DATABASE_URL is required');
  }

  const jwtSecret = rawEnv.JWT_SECRET?.trim();
  if (!jwtSecret) {
    errors.push('JWT_SECRET is required');
  }

  const expiresIn = rawEnv.EXPIRES_IN?.trim();
  if (!expiresIn) {
    errors.push('EXPIRES_IN is required');
  }

  const groqApiKey = rawEnv.GROQ_API_KEY?.trim();
  if (!groqApiKey) {
    errors.push('GROQ_API_KEY is required');
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n- ${errors.join('\n- ')}`,
    );
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: databaseUrl!,
    JWT_SECRET: jwtSecret!,
    EXPIRES_IN: expiresIn!,
    GROQ_API_KEY: groqApiKey!,
    FRONTEND_URL: rawEnv.FRONTEND_URL?.trim() || undefined,
  };
}
