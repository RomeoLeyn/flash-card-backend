import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const dbEntityPattern = __dirname + '/../../**/*.entity{.ts,.js}';
const dbMigrationPattern = __dirname + '/../../migrations/*{.ts,.js}';

export const getDbConfig = (
  configService?: ConfigService,
): TypeOrmModuleOptions => {
  const url =
    configService?.get<string>('DATABASE_URL') ?? process.env.DATABASE_URL;

  if (!url) {
    throw new Error('Configuration error: DATABASE_URL is not defined in .env');
  }

  return {
    type: 'postgres',
    url,
    entities: [dbEntityPattern],
    migrations: [dbMigrationPattern],
    autoLoadEntities: false,
    synchronize: false,
    migrationsRun: true,
    logging: process.env.NODE_ENV !== 'production',
  };
};

export const dbConfig = async (
  configService: ConfigService,
): Promise<TypeOrmModuleOptions> => getDbConfig(configService);
