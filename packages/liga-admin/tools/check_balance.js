const fs = require('fs');
const path = 'd:\\LigaInterna\\liga-admin\\src\\pages\\admin\\SeasonZones.jsx';
let s = fs.readFileSync(path, 'utf8');
let out = '';
let inSingle=false,inDouble=false,inTemplate=false,inBlock=false;
for(let i=0;i<s.length;i++){
  const c = s[i];
  const n = s[i+1];
  if(inBlock){ if(c==='*' && n==='/' ){ inBlock=false; i++; continue; } else continue; }
  if(inSingle){ if(c==='\\'){ i++; continue;} if(c==="'"){ inSingle=false; continue;} continue; }
  if(inDouble){ if(c==='\\'){ i++; continue;} if(c==='"'){ inDouble=false; continue;} continue; }
  if(inTemplate){ if(c==='`'){ inTemplate=false; continue;} if(c==='\\'){ i++; continue;} continue; }
  if(c==='/' && n==='*'){ inBlock=true; i++; continue; }
  if(c==='/' && n==='/' ){ // line comment
    while(i<s.length && s[i]!=='\n') i++;
    continue;
  }
  if(c==="'"){ inSingle=true; continue; }
  if(c==='"'){ inDouble=true; continue; }
  if(c==='`'){ inTemplate=true; continue; }
  out += c;
}
function count(ch){ return (out.split(ch).length-1); }
console.log('counts: ( ) { } [ ] ->', count('('), count(')'), count('{'), count('}'), count('['), count(']'));
// print last 40 lines for context
const lines = s.split('\n');
const start = Math.max(0, lines.length-120);
console.log('--- tail file ---');
console.log(lines.slice(start).join('\n'));
