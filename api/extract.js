export default async function handler(req,res) {
  if(req.method !== 'POST') return res.status(405).json({error:'Use POST'});
  const key=process.env.OPENAI_API_KEY;
  if(!key) return res.status(503).json({error:'Leitura por IA não configurada: falta OPENAI_API_KEY no servidor.'});
  try {
    const {image,date,operator,size}=req.body||{};
    if(typeof image!=='string'||!/^data:image\/(jpeg|png|webp);base64,/.test(image)||image.length>12500000)
      return res.status(400).json({error:'Envie uma imagem JPEG, PNG ou WebP de até aproximadamente 9 MB.'});
    const instructions=`Você extrai dados de uma foto de formulário brasileiro "Controle diário de corte e solda". Leia manuscritos com cuidado, SEM ADIVINHAR campos. Retorne SOMENTE JSON puro (sem markdown), objeto com "date", "operator", "size", "rows" e "warnings". Formato de rows: [{"bobbin":1,"product":"...","start":"HH:MM ou vazio","end":"HH:MM ou vazio","qty":1234 ou null,"stops":0 ou null,"notes":"...","uncertain":true ou false}]. Extraia uma linha para CADA bobina reconhecida, mesmo quando a quantidade estiver vazia. Preserve horários e contagens escritos na ficha; não calcule nem corrija valores suspeitos. Nunca copie quantidades de outra linha. "stops" significa APENAS duração de paradas explicitamente anotadas em minutos (não o intervalo entre bobinas); ausente = null. Não confunda cores, produto ou dimensão. Marque "uncertain":true quando leitura for duvidosa e descreva em notes. Se não conseguir ler, use string vazia ou null, jamais invente. Data em YYYY-MM-DD quando explícita; campos não legíveis podem receber as informações fornecidas como contexto. "warnings" deve ser lista de strings em português indicando campos duvidosos. Sem dados de pessoas, preços ou informações não pertencentes à ficha.`;
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify({model:process.env.OPENAI_VISION_MODEL||'gpt-4.1-mini',instructions,input:[{role:'user',content:[{type:'input_text',text:'Contexto fornecido pelo usuário (use somente para preencher campos omitidos na foto): data '+String(date||'')+', operador '+String(operator||'')+', tamanho '+String(size||'')+'. Extraia o formulário.'},{type:'input_image',image_url:image}]}],max_output_tokens:3000})
    });
    const out=await response.json();
    if(!response.ok) return res.status(502).json({error:'Falha no provedor de IA: '+(out.error?.message||response.status)});
    let txt=(out.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
    txt=txt.replace(/^\s*```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
    let data=JSON.parse(txt);
    if(!data||!Array.isArray(data.rows)) throw Error('Formato retornado inválido');
    data.rows=data.rows.slice(0,100).map(r=>({
      bobbin:Number.isInteger(Number(r.bobbin))&&Number(r.bobbin)>0?Number(r.bobbin):null,
      product:typeof r.product==='string'?r.product.slice(0,140):'',
      start:/^([01]\d|2[0-3]):[0-5]\d$/.test(r.start||'')?r.start:'',
      end:/^([01]\d|2[0-3]):[0-5]\d$/.test(r.end||'')?r.end:'',
      qty:typeof r.qty==='number'&&Number.isFinite(r.qty)&&r.qty>=0?r.qty:null,
      stops:typeof r.stops==='number'&&Number.isFinite(r.stops)&&r.stops>=0?r.stops:null,
      notes:typeof r.notes==='string'?r.notes.slice(0,220):'',
      uncertain:r.uncertain===true
    }));
    res.status(200).json({date:data.date||date||'',operator:data.operator||operator||'',size:data.size||size||'',rows:data.rows,warnings:Array.isArray(data.warnings)?data.warnings.slice(0,30):[]});
  } catch(e) {res.status(500).json({error:'Não foi possível interpretar a imagem: '+e.message});}
}