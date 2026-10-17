/** AI: Deno server compatibility for unchanged qualified Node crypto modules. */
import {Buffer} from 'node:buffer';
import process from 'node:process';
if(!globalThis.Buffer)globalThis.Buffer=Buffer;
if(!globalThis.process)globalThis.process=process;
