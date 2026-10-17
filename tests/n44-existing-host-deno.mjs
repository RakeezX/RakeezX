import '../drafts/n44-push/node-globals.mjs';
import pg from 'pg';
import {journey} from './fixtures/n44-existing-host/journey.mjs';
const config=JSON.parse(await Deno.readTextFile(Deno.args[0]));
if(config.host!=='127.0.0.1')throw Error('synthetic_loopback_only');
const admin=new pg.Client(config),pool=new pg.Pool({...config,max:4});
pool.on('connect',c=>{void c.query('set role n44_backend');});
try {await admin.connect();const report={checks:[]};await journey({pool,admin,report});console.log('N44 Deno composition PASS '+JSON.stringify(report));}
finally{await pool.end();await admin.end();}
