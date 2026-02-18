const fs = require('fs');
const path = 'd:\\LigaInterna\\liga-admin\\src\\pages\\admin\\SeasonZones.jsx';
const s = fs.readFileSync(path,'utf8');
const lines = s.split('\n');
let inSingle=false,inDouble=false,inTemplate=false,inBlock=false;
let paren=0, brace=0, bracket=0;
for(let li=0; li<lines.length; li++){
  const line = lines[li];
  for(let i=0;i<line.length;i++){
    const c=line[i];
    const n=line[i+1];
    if(inBlock){ if(c==='*' && n==='/' ){ inBlock=false; i++; continue; } else continue; }
    if(inSingle){ if(c==='\\'){ i++; continue;} if(c==="'"){ inSingle=false; continue;} continue; }
    if(inDouble){ if(c==='\\'){ i++; continue;} if(c==='"'){ inDouble=false; continue;} continue; }
    if(inTemplate){ if(c==='`'){ inTemplate=false; continue;} if(c==='\\'){ i++; continue;} continue; }
    if(c==='/' && n==='*'){ inBlock=true; i++; continue; }
    if(c==='/' && n==='/' ){ break; }
    if(c==="'"){ inSingle=true; continue; }
    if(c==='"'){ inDouble=true; continue; }
    if(c==='`'){ inTemplate=true; continue; }
    if(c==='(') paren++;
    if(c===')') paren--;
    if(c==='{') brace++;
    if(c==='}') brace--;
    if(c==='[') bracket++;
    if(c===']') bracket--;
  }
  if((li+1) % 10 === 0 || li+1 >= 360) console.log('L',li+1,'paren',paren,'brace',brace,'bracket',bracket,':',line.slice(0,120));
}
console.log('FINAL',paren,brace,bracket);
