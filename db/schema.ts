import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const portfolios = sqliteTable('portfolios', {userId:text('user_id').primaryKey(), data:text('data').notNull(), version:integer('version').notNull().default(0)});
export const paperAccounts=sqliteTable('paper_accounts',{userId:text('user_id').primaryKey(),data:text('data').notNull(),version:integer('version').notNull().default(0)});
export const marketSnapshots=sqliteTable('market_snapshots',{date:text('date').primaryKey(),data:text('data').notNull()});
export const officialPriceHistory=sqliteTable('official_price_history',{date:text('date').primaryKey(),data:text('data').notNull()});
export const userSettings=sqliteTable('user_settings',{userId:text('user_id').primaryKey(),data:text('data').notNull(),updatedAt:text('updated_at').notNull()});
export const userPriceHistory=sqliteTable('user_price_history',{key:text('key').primaryKey(),userId:text('user_id').notNull(),symbol:text('symbol').notNull(),data:text('data').notNull(),updatedAt:text('updated_at').notNull()});
