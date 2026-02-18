const fs=require('fs');
const s=fs.readFileSync('d:\\LigaInterna\\liga-admin\\src\\pages\\admin\\SeasonZones.jsx','utf8');
const lines=s.split('\n');
for(let i=0;i<lines.length;i++){
  if(i+1>=350 && i+1<=470) console.log((i+1).toString().padStart(4,' ')+': '+lines[i]);
}
