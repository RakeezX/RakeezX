/** AI: current N88 diagnostics; sanitize the WHOLE report, including call logs/stacks. */
export function redactN88(value) {
  if(typeof value==='string')return value.replace(/[1١۱][0-9٠-٩۰-۹]{5,}/g,'[REDACTED]');
  if(Array.isArray(value))return value.map(redactN88);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[redactN88(k),redactN88(v)]));
  return value;
}
export function diagnosticError(error) {
  // Assertion values and multiline locator diagnostics can contain arbitrary secrets.
  return redactN88({message:error?.code==='ERR_ASSERTION'?'Assertion failed (values omitted)':String(error?.message||'Check failed'),
    stack:String(error?.stack||'').split('\n').filter(l=>l.trimStart().startsWith('at ')).slice(0,5)});
}
