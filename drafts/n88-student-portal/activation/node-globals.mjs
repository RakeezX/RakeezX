/** AI: original Deno service compatibility for unchanged qualified Node modules. */
import {Buffer} from 'node:buffer';
import process from 'node:process';
if(!globalThis.Buffer)globalThis.Buffer=Buffer;
if(!globalThis.process)globalThis.process=process;
