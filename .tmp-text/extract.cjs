const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const specs = [
 ['commands/admin/ResetCommand', 'reset', 'RESET_FLOW_TEXT', {100:'failed'}],
 ['commands/casino/CasinoCommand','casino','CASINO_DESCRIPTION_TEXT',{29:'blackjack',30:'crash'}],
 ['commands/rpg/HelpCommand','help','HELP_FLOW_TEXT',{90:'failed'}],
 ['commands/rpg/RaidCommand','raid','RAID_FLOW_TEXT',{13:'huntDescription',15:'bossDescription',26:'alreadyProcessed',59:'alreadyProcessed'}],
 ['commands/rpg/SummonCommand','summon','SUMMON_RELIC_TEXT',{104:'sacredChoice',105:'supremeChoice',140:'relicCost'}],
 ['commands/rpg/RankedCommand','ranked','RANKED_RESULT_TEXT',{99:'rating',100:'bracket'}],
 ['commands/rpg/StartCommand','start','START_STATS_TEXT',{71:'baseStats'}],
 ['commands/admin/PingCommand','ping','PING_VALUE_TEXT',{53:'error',54:'latency'}],
 ['core/CommandRegistry','common','COMMAND_RECOVERY_TEXT',{38:'unavailable'}],
 ['domain/combat/CombatStatusEffects','combat','COMBAT_DOT_LABELS',{108:'bleed',110:'burn',112:'venom'}],
 ['menu/gameplayPanels','gameplay','GAMEPLAY_TEXT',{
 22:'cancel',26:['dailyClaimed','dailyClaim'],27:'hunt',28:'quests',36:'chooseClass',39:'baseStats',40:'starterRewards',41:'createCharacter',
 46:['confirmBoss','confirmReroll'],49:'bossConfirmation',50:'rerollConfirmation',51:'confirm',57:'onboardingTitle',58:'onboardingBody',
 70:['valorReward','shardReward'],72:'questRow',75:'weeklyIncomplete',76:'weeklyClaimed',77:'weeklyReady',79:'questsTitle',81:'questSections',83:'questHint',87:'claimWeekly',88:'rerollDaily',
 94:'hunt',95:'quests',96:'bossReady',97:'bossDone',98:'bossLowLevel',99:'bossLowBalance',101:'battleLobbyTitle',103:'huntInfo',104:'bossInfo',106:'resetTime',109:'boss',111:'lastBattle',
 118:'profileHeading',119:'profileExp',120:'profileCurrency',127:['gearRow','unequipped'],129:'deityRow',130:'noDeities',132:'profile',138:'equipmentSection',139:'deitiesSection',140:'combatStats',141:'hunt',
 149:'home',154:['profile','help','searchHelp'],155:'infoGroup',160:'boss',162:'activityGroup',164:'inventory',165:'deitySummon',166:'shop',167:'casino',168:'assetsGroup',
 176:'roundLog',195:'battleTitle',196:'noBattle',197:'hunt',203:'logTitle',204:'noLog',206:'first',207:'previous',208:'next',209:'last',210:'replay',214:'draw',215:'win',216:'lose',218:'resultTitle',221:'battleRewards',224:'levelUp',225:'bossFee'
 }],
 ['menu/MenuGameplayService','gameplay','GAMEPLAY_NOTICE',{157:'createFirst',175:'created',176:'alreadyCreated',177:'starterUnavailable',189:'cooldown',203:'alreadyProcessed',204:'noMonster',205:'createFirst'}],
 ['menu/menuViews','menu','MENU_VIEW_TEXT',{130:'player',146:'replay',159:'heading',166:'avatar',175:'chooseClass'}],
 ['render/BattleLogPager','battleLog','BATTLE_REPLAY_TEXT',{145:'button',184:'ownerOnly',212:'failed',246:'updateFailed',267:'expired',268:'busy',270:'cooldown'}],
 ['render/raidBattleOptions','raid','RAID_FOOTER_TEXT',{31:'bossFee'}],
 ['render/ProfileCardRenderer','profile','PROFILE_EXTRA_TEXT',{135:'believer',137:'rating'}],
 ['services/CasinoSessionService','casino','CASINO_SESSION_TEXT',{105:'finished',114:'invalidAction',134:'timeoutHint'}],
 ['services/LootGrantService','loot','LOOT_SEED_TEXT',{18:'missingRune'}],
 ['services/QuestService','quest','QUEST_FLOW_TEXT',{187:'dayChanged'}],
 ['services/RaidService','raid','RAID_CONFIRMATION_TEXT',{290:'dayChanged'}],
 ['utils/weightedRandom','common','REWARD_DATA_TEXT',{22:'missingSeed'}],
];
function replace(file, edits, importLine) {
 let source=fs.readFileSync(file,'utf8');
 for(const e of edits.sort((a,b)=>b.start-a.start)) source=source.slice(0,e.start)+e.text+source.slice(e.end);
 fs.writeFileSync(file,importLine+'\n'+source);
}
function importPath(from,to){let p=path.relative(path.dirname(from),to).replaceAll('\\','/').replace(/\.ts$/,'.js');return p.startsWith('.')?p:'./'+p;}
for(const [relative,module,group,lines] of specs){
 const file='src/'+relative+'.ts', target='src/text/'+module+'.ts';
 if(fs.readFileSync(file,'utf8').includes('import { '+group+' }')) continue;
 const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),99,true), edits=[], definitions=new Map(), counts={};
 function visit(n){
  if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isTemplateExpression(n)){
   const line=sf.getLineAndCharacterOfPosition(n.getStart()).line+1;
   if(lines[line]){
    // Ignore technical keys and select only visible strings on mixed code lines.
    const raw=ts.isTemplateExpression(n)?n.head.text+n.templateSpans.map(s=>s.literal.text).join(''):n.text;
    if(!raw.trim()) return;
    if(!ts.isTemplateExpression(n)&&!/[À-ỹ\s]/.test(raw)&&!['Casino'].includes(raw)) return;
    const names=Array.isArray(lines[line])?lines[line]:[lines[line]];
    const index=counts[line]??0;const key=names[index];if(!key)throw Error(file+':'+line+' extra '+raw);counts[line]=index+1;
    let declaration=n.getText(sf), call=group+'.'+key;
    if(ts.isTemplateExpression(n)){
     const params=n.templateSpans.map((s,i)=>{
      let name=s.expression.getText(sf).match(/(?:\.|^)([A-Za-z_$][\w$]*)\s*$/)?.[1];
      if(!name||['true','false','default','class'].includes(name))name='value'+(i+1);
      return name;
     });
     const used=new Set();for(let i=0;i<params.length;i++){while(used.has(params[i]))params[i]+='Value';used.add(params[i]);}
     let template='`'+n.head.rawText;
     n.templateSpans.forEach((s,i)=>template+='${'+params[i]+'}'+s.literal.rawText);
     template+='`';
     declaration='('+params.map(p=>p+': string | number').join(', ')+'): string => '+template;
     call+='('+n.templateSpans.map(s=>s.expression.getText(sf)).join(', ')+')';
    }
    if(definitions.has(key)&&definitions.get(key)!==declaration)throw Error('Conflicting '+key);
    definitions.set(key,declaration);edits.push({start:n.getStart(),end:n.end,text:call});return;
   }
  }ts.forEachChild(n,visit);
 }visit(sf);
 for(const [line,value] of Object.entries(lines))if((counts[line]??0)!==(Array.isArray(value)?value.length:1))throw Error(file+':'+line+' missing');
 fs.appendFileSync(target,'\n/** Display text for '+relative+'. */\nexport const '+group+' = {\n'+[...definitions].map(([key,value])=>key+': '+value+',').join('\n')+'\n};\n');
 replace(file,edits,'import { '+group+' } from '+JSON.stringify(importPath(file,target))+';');
 console.log(relative+': '+edits.length);
}
