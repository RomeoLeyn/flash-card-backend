import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error('Configuration error: DATABASE_URL is not defined in .env');
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: dbUrl,
  entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../../migrations/*{.ts,.js}'],
  synchronize: false,
  migrationsRun: true,
  logging: process.env.NODE_ENV !== 'production',
});
