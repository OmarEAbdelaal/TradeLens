import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const portfolios = sqliteTable('portfolios', {userId:text('user_id').primaryKey(), data:text('data').notNull(), version:integer('version').notNull().default(0)});
export const paperAccounts=sqliteTable('paper_accounts',{userId:text('user_id').primaryKey(),data:text('data').notNull(),version:integer('version').notNull().default(0)});
export const marketSnapshots=sqliteTable('market_snapshots',{date:text('date').primaryKey(),data:text('data').notNull()});
export const userSettings=sqliteTable('user_settings',{userId:text('user_id').primaryKey(),data:text('data').notNull(),updatedAt:text('updated_at').notNull()});
