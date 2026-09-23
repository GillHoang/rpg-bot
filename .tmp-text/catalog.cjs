const ts=require('typescript'),fs=require('fs');
fs.mkdirSync('src/text/catalog',{recursive:true});
for(const name of ['weapons','armors','deities','mobs','runes','cosmetics','titles']){
 const file='src/seed/data/'+name+'.ts', source=fs.readFileSync(file,'utf8'), sf=ts.createSourceFile(file,source,99,true);
 const group=name.toUpperCase()+'_TEXT', entries=[], edits=[];
 const fields=new Set(['name','mythology','passiveName','passiveDescription','lore','blessingName','blessingDescription','skillName','skillDescription','description','displayName','display','howTo']);
 function visit(n){
  if(ts.isObjectLiteralExpression(n)){
   const props=n.properties.filter(ts.isPropertyAssignment);
   const selected=props.filter(p=>fields.has(p.name.getText(sf))&&ts.isStringLiteral(p.initializer));
   if(selected.length){
    const id=props.find(p=>['weaponRosterId','armorRosterId','deityId','mobId','cosmeticKey','code'].includes(p.name.getText(sf)));
    const key=id?JSON.parse(JSON.stringify(id.initializer.text)):String(entries.length+1);
    entries.push(JSON.stringify(key)+': {\n'+selected.map(p=>p.name.getText(sf)+': '+p.initializer.getText(sf)+',').join('\n')+'\n},');
    for(const p of selected) edits.push({start:p.initializer.getStart(),end:p.initializer.end,text:group+'['+JSON.stringify(key)+'].'+p.name.getText(sf)});
   }
  } ts.forEachChild(n,visit);
 }visit(sf);
 let output=source;for(const e of edits.sort((a,b)=>b.start-a.start)) output=output.slice(0,e.start)+e.text+output.slice(e.end);
 output=output.replace(/Sửa text[^\r\n]*|Sửa toàn bộ text[^\r\n]*|Toàn bộ text[^\r\n]*/g,'Text hiển thị: src/text/catalog/'+name+'.ts; chạy pnpm db:seed sau khi sửa.');
 fs.writeFileSync(file,'import { '+group+' } from "../../text/catalog/'+name+'.js";\n'+output);
 fs.writeFileSync('src/text/catalog/'+name+'.ts','/** Catalog display text. Keep entry keys stable; run db:seed after editing. */\nexport const '+group+' = {\n'+entries.join('\n')+'\n};\n');
 console.log(name+': '+edits.length+' text fields');
}
const file='src/config/pvpShop.ts';let source=fs.readFileSync(file,'utf8');const sf=ts.createSourceFile(file,source,99,true),rows=[],edits=[];
function visit(n){if(ts.isObjectLiteralExpression(n)){const props=n.properties.filter(ts.isPropertyAssignment),key=props.find(p=>p.name.getText(sf)==='key'),label=props.find(p=>p.name.getText(sf)==='label');if(key&&label){rows.push(key.initializer.getText(sf)+': '+label.initializer.getText(sf)+',');edits.push({start:label.initializer.getStart(),end:label.initializer.end,text:'PVP_SHOP_LABELS['+key.initializer.getText(sf)+']'});}}ts.forEachChild(n,visit);}visit(sf);
for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.text+source.slice(e.end);
fs.writeFileSync(file,'import { PVP_SHOP_LABELS } from "../text/pvp.js";\n'+source);
fs.appendFileSync('src/text/pvp.ts','\nexport const PVP_SHOP_LABELS = {\n'+rows.join('\n')+'\n};\n');
