const fs=require('fs');
const s=fs.readFileSync('d:\\LigaInterna\\liga-admin\\src\\pages\\admin\\SeasonZones.jsx','utf8');
let dq=0,sq=0,bq=0;
for(let i=0;i<s.length;i++){ if(s[i]==='"') dq++; if(s[i]==="'") sq++; if(s[i]==='`') bq++; }
console.log('double',dq,'single',sq,'backtick',bq);