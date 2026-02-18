const fs = require('fs');
const path = 'd:\\LigaInterna\\liga-admin\\src\\pages\\admin\\SeasonZones.jsx';
let s = fs.readFileSync(path, 'utf8');
let out = '';
let inSingle=false,inDouble=false,inTemplate=false,inBlock=false;
let paren=0, brace=0, bracket=0;
for(let i=0;i<s.length;i++){
  const c = s[i];
  const n = s[i+1];
  if(inBlock){ if(c==='*' && n==='/' ){ inBlock=false; i++; continue; } else continue; }
  if(inSingle){ if(c==='\\'){ i++; continue;} if(c==="'"){ inSingle=false; continue;} continue; }
  if(inDouble){ if(c==='\\'){ i++; continue;} if(c==='"'){ inDouble=false; continue;} continue; }
  if(inTemplate){ if(c==='`'){ inTemplate=false; continue;} if(c==='\\'){ i++; continue;} continue; }
  if(c==='/' && n==='*'){ inBlock=true; i++; continue; }
  if(c==='/' && n==='/' ){ while(i<s.length && s[i]!=='\n') i++; continue; }
  if(c==="'"){ inSingle=true; continue; }
  if(c==='"'){ inDouble=true; continue; }
  if(c==='`'){ inTemplate=true; continue; }
  if(c==='('){ paren++; }
  if(c===')'){ paren--; if(paren<0){ console.log('Unmatched ) at index', i); console.log(s.slice(Math.max(0,i-120),i+40)); process.exit(1);} }
  if(c==='{'){ brace++; }
  if(c==='}'){ brace--; if(brace<0){ console.log('Unmatched } at index', i); console.log(s.slice(Math.max(0,i-120),i+40)); process.exit(1);} }
  if(c==='['){ bracket++; }
  if(c===']'){ bracket--; if(bracket<0){ console.log('Unmatched ] at index', i); console.log(s.slice(Math.max(0,i-120),i+40)); process.exit(1);} }
}
console.log('final counts paren,brace,bracket',paren,brace,bracket);
