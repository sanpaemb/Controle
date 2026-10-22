(function(root){
 "use strict";
 const LUNCH_AT=12*60,DAY_END=21*60;
 function minute(v){
  if(typeof v!=="string")return null;
  const m=/^([01]?\d|2[0-3]):([0-5]\d)$/.exec(v.trim());
  return m?Number(m[1])*60+Number(m[2]):null;
 }
 function inspect(row){
  const a=minute(row.start),b=minute(row.end);
  const notes=[],flags=[];
  const actual=!!(row.product||row.start||row.end||row.qty!==null&&row.qty!==undefined&&row.qty!=="");
  if(!actual)return {active:false,minutes:null,notes,flags,afterHours:false,lunchCrossing:false};
  if(a!==null&&b===null){notes.push("Horário de finalização não informado; prosseguir para a próxima bobina.");flags.push("fim-ausente")}
  if(a===null&&b!==null){notes.push("Horário inicial não informado.");flags.push("inicio-ausente")}
  if(a!==null&&b!==null&&b<a){notes.push("Término anterior ao início; conferir apontamento.");flags.push("horario-invalido")}
  const crossing=a!==null&&b!==null&&a<LUNCH_AT&&b>LUNCH_AT;
  if(crossing){notes.push("Período atravessa 12h (almoço). Duração da pausa não informada; produtividade desconsiderada.");flags.push("almoco-sem-retorno")}
  const late=b!==null&&b>DAY_END;
  if(late){notes.push("Término após as 21h registrado: "+row.end+". Considerado o horário efetivamente apontado.");flags.push("apos-expediente")}
  // Never infer a 12:00 or 21:00 end from shift rules.
  return {active:true,minutes:a!==null&&b!==null&&b>a&&!crossing?b-a:null,notes,flags,afterHours:late,lunchCrossing:crossing};
 }
 root.SanpaShift={minute,inspect,LUNCH_AT,DAY_END};
})(typeof window!=="undefined"?window:globalThis);
