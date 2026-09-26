import {database} from '@/db/store';
import {newAccount,type Account} from './paper';
import {accountScope,type MarketId} from './markets';
export async function readAccount(user:string,id:MarketId,currency:string){
 const db=database();const legacy=id==='dfm'&&currency==='AED';const key=legacy?user:accountScope(user,id,currency);
 // Existing Dubai balances and trade history retain their original identity.
 if(legacy)await db.prepare('INSERT INTO paper_accounts(user_id,data,version) VALUES(?,?,0) ON CONFLICT(user_id) DO NOTHING').bind(user,JSON.stringify(newAccount())).run();
 else await db.prepare('INSERT INTO market_accounts(key,user_id,market,currency,data,version) VALUES(?,?,?,?,?,0) ON CONFLICT(key) DO NOTHING').bind(key,user,id,currency,JSON.stringify(newAccount(id,currency))).run();
 const row=legacy?await db.prepare('SELECT data,version FROM paper_accounts WHERE user_id=?').bind(user).first<{data:string;version:number}>():await db.prepare('SELECT data,version FROM market_accounts WHERE key=? AND user_id=?').bind(key,user).first<{data:string;version:number}>();
 if(!row)throw new Error('Account unavailable');return {account:{...JSON.parse(row.data),marketId:id,currency} as Account,version:row.version};
}
export async function saveAccount(user:string,id:MarketId,currency:string,account:Account,version:number){
 const db=database();return id==='dfm'&&currency==='AED'
 ?db.prepare('UPDATE paper_accounts SET data=?,version=version+1 WHERE user_id=? AND version=?').bind(JSON.stringify(account),user,version).run()
 :db.prepare('UPDATE market_accounts SET data=?,version=version+1 WHERE key=? AND user_id=? AND version=?').bind(JSON.stringify(account),accountScope(user,id,currency),user,version).run();
}
