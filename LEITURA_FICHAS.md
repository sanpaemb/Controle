# SANPA Controle — leitura de fichas por IA de visão

O fluxo de produção em `/producao/captura.html` é: **foto → OpenAI Vision → dashboard de prévia → aprovar ou descartar**. O OCR Tesseract anterior foi retirado do fluxo principal.

## Configuração privada na Vercel (obrigatória)
No projeto `sanpa-controle`, abra **Settings → Environment Variables** e adicione para **Production**:
- `OPENAI_API_KEY`: chave válida da API OpenAI (não é fornecida pela assinatura ChatGPT). Crie em https://platform.openai.com/api-keys. Ative faturamento/limite de gastos da API.
- `CAPTURE_PIN`: um código forte de acesso privado, distinto da chave. O frontend solicita **uma vez por aba** e mantém somente em `sessionStorage` até a aba ser fechada. Isso protege contra pessoas desconhecidas consumirem sua conta da API.
- `OPENAI_VISION_MODEL` (opcional): o padrão é `gpt-4.1`.

Depois de cadastrar, faça **Redeploy** da implantação de produção (as variáveis novas só chegam a implantações posteriores). **Nunca envie a chave no chat, adicione-a ao GitHub ou deixe-a no código da página.**

Acesse: https://sanpa-controle.vercel.app/producao/captura.html. Informe uma vez o código, escolha a foto. Os dados são analisados no servidor pela rota `/api/extract`. O programa prepara a foto completa e, quando couber no limite de tamanho, dois recortes da mesma folha para ampliar manuscritos.

## Política de leitura e cálculos
- Reconhecer apenas bobinas que contenham apontamentos de produção. Blocos impressos e não preenchidos não contam como bobinas produzidas.
- Campos não legíveis ficam vazios/nulos; não presumir horário, quantidade, operadores ou produto.
- 12h: referência de almoço; não deduzir tempo de parada ou retorno. Bobinas que atravessam esse horário, sem pausa documentada, **não entram em cálculo de produtividade**.
- 21h: encerramento normal. Horário de fim **após 21h**, se escrito na ficha, prevalece.
- Sem horário final: registrar observação e seguir para a bobina seguinte. Esses registros podem ser aprovados como incompletos.
- Quantidade total de unidades inclui apenas valores reconhecidos; sem quantidade não significa zero.
- Paradas em minutos: usar apenas apontamentos explícitos, caso contrário `null`.
- Antes de salvar: verificar gráficos, tabela, observações e lacunas. O clique **Aprovar e salvar** adiciona registros ao histórico local; **Descartar** não grava.

## Segurança, custos e armazenamento
A chave da OpenAI permanece **somente na Vercel**. O PIN bloqueia solicitações externas não autorizadas, mas **não é autenticação empresarial completa**; equipe grande requer login individual, rate limiting, auditoria e limites de gasto. As imagens são enviadas à API da OpenAI para processamento e não são armazenadas como anexos no histórico do SANPA.

Dados aprovados são salvos em `localStorage['sanpa-prod-2026']`, **somente no navegador/aparelho que aprovou**. A abertura da página em outro computador não sincroniza os dados. Faça exportações de backup JSON do dashboard, ou implemente banco de dados central com login e backups para operações em vários dispositivos.

Erros:
- HTTP 503: falta `OPENAI_API_KEY` e/ou `CAPTURE_PIN` na implantação.
- HTTP 401: PIN não corresponde ao do servidor.
- HTTP 429: saldo/limite/taxa da API OpenAI.
- HTTP 413: imagem excedeu o limite.
- HTTP 422: IA não identificou bobinas preenchidas.
