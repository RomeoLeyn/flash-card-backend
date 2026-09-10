import { registerAs } from '@nestjs/config';
import * as ms from 'ms';

export interface JwtConfig {
  secret: string;
  expiresIn: ms.StringValue | number;
}

export default registerAs('jwt', (): JwtConfig => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.EXPIRES_IN;

  if (!secret) {
    throw new Error('Configuration error: JWT_SECRET is not defined in .env');
  }
  if (!expiresIn) {
    throw new Error('Configuration error: EXPIRES_IN is not defined in .env');
  }

  return {
    secret,
    expiresIn: isNaN(Number(expiresIn))
      ? (expiresIn as ms.StringValue)
      : Number(expiresIn),
  };
});
