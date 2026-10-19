// Existing approved N36 package boundary: school host access remains forbidden.
export function approvedPackageBoundary(m){
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 return same(m.permissions,['activeTab','scripting','storage','alarms'])
 && (m.host_permissions===undefined||same(m.host_permissions,['https://rakeezx.com/*']))
 && same(m.externally_connectable,{matches:['https://rakeezx.com/*']})
 && !m.optional_permissions&&!m.optional_host_permissions
 && m.content_security_policy?.extension_pages==="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
}
