import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to run Drizzle commands');
}

const dbUrl = process.env.DATABASE_URL;
const needsSsl = /sslmode=(require|verify-full|verify-ca|prefer|no-verify)/iu.test(dbUrl);

export default defineConfig({
  dialect: 'postgresql',
  out: './drizzle',
  schema: './src/schema.ts',
  dbCredentials: {
    url: dbUrl,
    ...(needsSsl && { ssl: { rejectUnauthorized: false } }),
  },
  strict: true,
  verbose: true,
});
