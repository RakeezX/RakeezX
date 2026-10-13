import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from '../src/lib/student-import-parsers.js';
// Test-only ZIP writer: stored entries, standard CRC32. No Product writer added.
const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
function zip(files){const entries=[],directory=[];let offset=0;
  for(const [name,value] of Object.entries(files)){
    const data=Buffer.from(value),filename=Buffer.from(name),crc=crc32(data),local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(filename.length,26);
    entries.push(local,filename,data);const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);directory.push(central,filename);offset+=local.length+filename.length+data.length;
  }const body=Buffer.concat(entries),central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(body.length,16);return Buffer.concat([body,central,end]);
}
export async function xlsxFixtures(){
  const original=unzipSync(new Uint8Array(await readFile(new URL('./n12-students.xlsx',import.meta.url))));
  const path=Object.keys(original).find(k=>/^xl\/worksheets\/.+\.xml$/.test(k));
  const base=strFromU8(original[path]);
  const formula=base.replace(/(<c\b[^>]*r="B2"[^>]*>)[\s\S]*?(<\/c>)/,'$1<f>1+1</f>$2');
  const duplicate=base.replace('</row>', '<c r="A1" t="inlineStr"><is><t>Duplicate</t></is></c></row>');
  return {valid:zip(original),formula:zip({...original,[path]:Buffer.from(formula)}),duplicate:zip({...original,[path]:Buffer.from(duplicate)})};
}
