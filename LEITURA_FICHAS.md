# Leitura automática das fichas de produção

A ferramenta `producao/captura.html` recebe fotografias de fichas manuscritas, envia para análise de imagem por IA, apresenta uma prévia editável e somente após confirmação adiciona as bobinas ao histórico local do dashboard. Os dados não são gravados diretamente no GitHub nem sincronizados entre aparelhos.

## Implantação necessária

O repositório GitHub por si só ou GitHub Pages **não executa** a função `api/extract.js`. Hospede o projeto em uma plataforma compatível com funções de servidor no formato Vercel e configure, nas variáveis de ambiente do projeto:

- `OPENAI_API_KEY`: chave privada da API, **somente no servidor**, nunca no HTML.
- `CAPTURE_PIN`: código privado exigido no formulário para impedir uso público irrestrito da API.
- `OPENAI_VISION_MODEL` (opcional): padrão `gpt-4.1-mini`.

Publique novamente após configurar. Teste enviando uma foto no menu **Dashboard de produção → Capturar ficha diária → Ler foto automaticamente com IA**. Compare a transcrição com a fotografia e confirme o lançamento. A IA pode interpretar de forma errada números manuscritos; nunca dispensa a conferência.

Se a hospedagem atual for GitHub Pages, o botão informará que o serviço de IA não está disponível. Nessa hospedagem, continua funcionando a digitação assistida, colagem de linhas e importação CSV.

## Privacidade e custos

A leitura por IA envia a fotografia à API configurada e implica custo por utilização. Não exponha a chave da API no navegador ou no repositório. `CAPTURE_PIN` é uma barreira básica e **não substitui autenticação, rate limiting e monitoramento de gastos** para operação em larga escala.

## Fluxo e armazenamento

O frontend utiliza `localStorage['sanpa-prod-2026']`. O lançador impede duplicação por data, operador e número da bobina. A IA deixa em branco campos que não identifica e solicita conferência antes de salvar. Faça backups JSON periódicos; para sincronização entre funcionários, implante banco de dados e autenticação.
