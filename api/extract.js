// SANPA Controle — foto manuscrita -> registros estruturados.
// Somente uma chamada com credenciais privadas no servidor. Nunca expor chave no frontend.
const MAX_REQUEST_CHARS=4300000;
const TIME=/^([01]\d|2[0-3]):[0-5]\d$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const IMG=/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MODEL=process.env.OPENAI_VISION_MODEL||'gpt-4.1';
const prompt=[
'Você é especialista em ler FOTOS de fichas brasileiras de CONTROLE DIÁRIO DE CORTE E SOLDA da SANPA.',
'Você verá uma fotografia completa e, opcionalmente, recortes AMPLIADOS da MESMA fotografia. Não são fichas distintas: use os recortes apenas para ler melhor manuscritos.',
'Leia a ficha pelo LAYOUT, não por uma linha corrida. Identifique o cabeçalho (data/operador) e cada bloco efetivamente preenchido de BOBINA, produto, cor, medida, início/fim, quantidade total produzida, minutos de parada e motivos.',
'Uma bobina apenas impressa no modelo, SEM anotações manuscritas de produção, NÃO deve virar linha. Nunca invente seis bobinas por existirem seis blocos na ficha.',
'Use null para quantidade/paradas ilegíveis ou ausentes, string vazia para horários/produtos ilegíveis. Não troque colunas ou atribua a quantidade da bobina anterior à seguinte.',
'Quantidade produzida NÃO é contagem de paradas. Campos de refugo, peso, total do dia e lote não devem ser confundidos com quantidade por bobina.',
'REGRAS DA FÁBRICA: 12:00 é início de almoço; não deduza horário de retorno, duração da pausa ou término da bobina. 21:00 é encerramento normal, NÃO o horário presumido de término. Se houver horário escrito após 21h, preserve-o fielmente. Se NÃO houver horário de fim, deixe end="" e escreva em notes "Horário de finalização não informado"; CONTINUE para a bobina seguinte.',
'Se a bobina atravessar 12h, informe que o período cruza almoço e duração da pausa não foi informada; não tente calcular produtividade (o painel faz isso).',
'As paradas só podem ser preenchidas quando a ficha as registra EXPLICITAMENTE em MINUTOS; caso contrário stops=null (nunca substitua por zero).',
'A data deve ser YYYY-MM-DD quando legível. Medidas usar 16×20, 20×30 etc. Preserve o nome do operador como escrito; nomes comuns: Gustavo e Lucas, mas NÃO assuma um deles sem evidência.',
'Notas legíveis sobre falhas ou problemas mecânicos devem ir em notes, inclusive quando não houver fim anotado.',
'uncertain=true quando algum dado relevante de uma linha for duvidoso/ilegível. warnings deve descrever dúvidas. Nunca gere valores estimados, horários de expediente ou totais inventados.',
'Retorne EXCLUSIVAMENTE o objeto JSON no formato estruturado solicitado.'
].join('\n');
const rowSchema={
 type:'object',additionalProperties:false,
 properties:{
  bobbin:{type:['integer','null']},
  product:{type:'string'},size:{type:'string'},
  start:{type:'string'},end:{type:'string'},
  qty:{type:['integer','null']},stops:{type:['number','null']},
  notes:{type:'string'},uncertain:{type:'boolean'}
 },
 required:['bobbin','product','size','start','end','qty','stops','notes','uncertain']
};
const schema={
 type:'object',additionalProperties:false,
 properties:{
  date:{type:'string'},operator:{type:'string'},size:{type:'string'},
  rows:{type:'array',items:rowSchema},
  warnings:{type:'array',items:{type:'string'}}
 },
 required:['date','operator','size','rows','warnings']
};
function fail(res,status,error){return res.status(status).json({error})}
function normTime(v){return typeof v==='string'&&TIME.test(v.trim())?v.trim():''}
function normSize(v){return typeof v==='string'?v.trim().replace(/\s*[xX×]\s*/g,'×').slice(0,40):''}
function normInt(v){return typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:null}
function normStops(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1440?v:null}
function trim(v,max){return typeof v==='string'?v.trim().slice(0,max):''}
function normalize(data){
 const date=trim(data.date,12),operator=trim(data.operator,80),size=normSize(data.size),warnings=Array.isArray(data.warnings)?data.warnings.slice(0,35).map(x=>trim(x,250)).filter(Boolean):[];
 const seen=new Set(),rows=[];
 for(const raw of (Array.isArray(data.rows)?data.rows:[]).slice(0,36)){
  if(!raw||typeof raw!=='object')continue;
  const bobbin=Number.isInteger(raw.bobbin)&&raw.bobbin>=1&&raw.bobbin<=36?raw.bobbin:null;
  if(bobbin===null){warnings.push('Foi encontrado um bloco sem número de bobina identificável.');continue}
  if(seen.has(bobbin)){warnings.push('Bobina '+bobbin+' apareceu mais de uma vez na leitura: conferir foto.');continue}
  const product=trim(raw.product,160),start=normTime(raw.start),end=normTime(raw.end),qty=normInt(raw.qty),stops=normStops(raw.stops);
  // Não inventar bobinas vazias só por constarem do formulário impresso.
  if(!product&&!start&&!end&&qty===null&&!trim(raw.notes,200))continue;
  seen.add(bobbin);
  const notes=[trim(raw.notes,350)];
  if(start&&!end&&!notes.some(x=>/finaliza[cç][aã]o n[aã]o informad/i.test(x)))notes.push('Horário de finalização não informado; seguir para a próxima bobina.');
  const startMin=start?Number(start.slice(0,2))*60+Number(start.slice(3)):null;
  const endMin=end?Number(end.slice(0,2))*60+Number(end.slice(3)):null;
  if(endMin!==null&&endMin>1260)notes.push('Finalização real após 21h registrada: '+end);
  if(startMin!==null&&endMin!==null&&startMin<720&&endMin>720)notes.push('Intervalo atravessa o almoço; pausa não quantificada.');
  rows.push({bobbin,product,size:normSize(raw.size)||size,start,end,qty,stops,notes:notes.filter(Boolean).join(' | '),
     uncertain:Boolean(raw.uncertain||qty===null||!product||!start)});
 }
 if(!DATE.test(date))warnings.push('Data não identificada no formato esperado.');
 if(!operator)warnings.push('Operador não identificado.');
 if(!rows.length)warnings.push('Nenhuma bobina preenchida identificada com confiança suficiente.');
 return {date:DATE.test(date)?date:'',operator,size,rows:rows.sort((a,b)=>a.bobbin-b.bobbin),warnings};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method==='GET')return res.status(200).json({service:'SANPA Vision',ready:Boolean(process.env.OPENAI_API_KEY&&process.env.CAPTURE_PIN),authRequired:true});
 if(req.method!=='POST')return fail(res,405,'Método não permitido.');
 const key=process.env.OPENAI_API_KEY,pin=process.env.CAPTURE_PIN;
 if(!key)return fail(res,503,'Falta configurar OPENAI_API_KEY no ambiente Production da Vercel. O código de acesso já pode estar configurado; a leitura depende da chave da API.');
 if(!pin)return fail(res,503,'Falta configurar CAPTURE_PIN no ambiente Production da Vercel.');
 // Uma senha no servidor protege o consumo da API de terceiros. Não há PIN embutido no código.
 if(typeof req.headers['x-capture-pin']!=='string'||req.headers['x-capture-pin']!==pin)return fail(res,401,'Código de acesso incorreto. Informe o código configurado na Vercel.');
 let data=req.body;
 if(typeof data==='string'){try{data=JSON.parse(data)}catch{return fail(res,400,'Dados da imagem inválidos.')}}
 if(!data||typeof data!=='object')return fail(res,400,'Envie uma fotografia.');
 const imgs=[data.image,...(Array.isArray(data.crops)?data.crops.slice(0,2):[])];
 if(!imgs[0]||imgs.some(x=>typeof x!=='string'||!IMG.test(x))||JSON.stringify(data).length>MAX_REQUEST_CHARS)return fail(res,413,'Imagem inválida ou muito grande. Tire uma foto mais nítida ou reduza o tamanho.');
 try {
  const images=imgs.map(image_url=>({type:'input_image',image_url,detail:'high'}));
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),55000);
  let reply;
  try{
   reply=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',signal:ac.signal,headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({
      model:MODEL,instructions:prompt,
      input:[{role:'user',content:[{type:'input_text',text:'Estas imagens são a mesma ficha de produção: primeira foto completa e as demais recortes da mesma foto, não fichas diferentes. Extraia os registros de bobinas de produção.'},...images]}],
      text:{format:{type:'json_schema',name:'sanpa_production_sheet',strict:true,schema}},
      max_output_tokens:4200
    })
   });
  }finally{clearTimeout(timer)}
  let result={};
  try{result=await reply.json()}catch{return fail(res,502,'A API de visão não retornou uma resposta válida.')}
  if(!reply.ok){
   const code=result?.error?.code||'';
   if(reply.status===401)return fail(res,502,'Chave da API inválida ou sem permissão. Verifique OPENAI_API_KEY na Vercel.');
   if(reply.status===429)return fail(res,429,'Limite ou saldo da API OpenAI atingido. Verifique faturamento e limites na plataforma OpenAI.');
   return fail(res,502,'Falha da API de visão ('+reply.status+'): '+trim(result?.error?.message,180));
  }
  const output=(result.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
  if(!output)return fail(res,502,'A IA não conseguiu produzir dados estruturados. Tente outra foto mais nítida.');
  let parsed;try{parsed=JSON.parse(output)}catch{return fail(res,502,'A IA não retornou JSON válido; nenhuma bobina foi salva.')}
  const payload=normalize(parsed);
  if(!payload.rows.length)return res.status(422).json({error:'A IA não identificou bobinas preenchidas nessa fotografia. Fotografe a ficha inteira, de frente e com boa iluminação.',...payload});
  return res.status(200).json({...payload,source:'openai_vision',saved:false});
 }catch(err){return fail(res,502,err?.name==='AbortError'?'A análise ultrapassou o tempo permitido. Envie novamente com a foto mais nítida.':'Não foi possível acessar a IA. Tente novamente.');}
}
