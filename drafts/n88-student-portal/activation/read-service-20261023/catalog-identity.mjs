/** AI: JSON object field order is not routine identity; all values/order remain exact. */
const fields=['name','definition','arguments','definer','owner','config','acl'];
export function canonicalCatalog(rows){
 if(!Array.isArray(rows))throw Error('n88_typed_catalog_rows_shape');
 return rows.map(r=>{
  if(!r||Object.keys(r).sort().join(',')!==[...fields].sort().join(','))throw Error('n88_typed_catalog_fields_shape');
  return Object.fromEntries(fields.map(k=>[k,r[k]]));
 });
}
