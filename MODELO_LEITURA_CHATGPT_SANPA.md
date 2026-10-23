# Modelo de leitura de fichas SANPA pelo ChatGPT (sem API no site)

## Objetivo

Envie a foto da ficha manuscrita **nesta conversa do ChatGPT** e solicite: **"Leia esta ficha de corte e solda da SANPA e entregue o arquivo JSON para importar no SANPA Controle. Use nosso modelo de produção e não invente valores."**

O ChatGPT interpreta visualmente a foto e produz um arquivo `.json` para download. O usuário importa o arquivo em `https://sanpa-controle.vercel.app/producao/captura.html` no painel **"Importar leitura feita aqui no ChatGPT"**. O navegador monta dashboard de prévia, unidades, horários, observações e indicadores sem chamar a OpenAI API. O operador aprova ou descarta; não há salvamento automático.

**Não é treinamento de um modelo de IA no site.** A capacidade de interpretação das fotos vem do ChatGPT aqui na conversa, não de OCR local nem de uso gratuito da API OpenAI pelo site. O uso do ChatGPT segue o plano/limites da conta.

## Regras obrigatórias de transcrição

- **Somente o manuscrito comprovadamente preenchido**: não contar espaços/bobinas impressos vazios.
- Leia data, operador, identificação/numero da bobina, medida (ex.: 16×20), produto/cor, início e fim, quantidade produzida, paradas em minutos e motivos.
- Se uma ficha contém várias bobinas, cada bobina é uma linha independente no JSON.
- Preserve rigorosamente os números escritos; **NUNCA calcule, deduza ou adivinhe quantidades, horários, totais ou paradas**.
- Campo não legível: `qty: null`, `stops: null`, `start: ""`, `end: ""` e/ou `product: ""`. Assinale `uncertain: true` e explique em `notes` e `warnings`.
- **12h é referência de almoço**, não horário para completar automaticamente. Bobina atravessando 12h sem pausa documentada não entra na produtividade.
- **21h é fim regular**. Se a ficha mostra 21:35 como término, preservá-lo como 21:35; não limitar a 21h.
- **Sem horário de fim:** deixar `end: ""`, escrever `"Horário de finalização não informado"` em `notes` e continuar lendo a próxima bobina.
- Evitar confundir hora de entrada, intervalos entre bobinas, perdas, refugo ou peso com minutos de paradas.
- Datas em `YYYY-MM-DD`; horários em `HH:MM`; quantidades numéricas sem separador de milhar.
- Se duas fotografias são frente e verso da mesma ficha, podem ser um arquivo. Se são datas/operadores diferentes, um arquivo por ficha é preferível; o importador também aceita `date` e `operator` em cada linha para casos mistos.

## Estrutura JSON aceita pelo SANPA

```json
{
  "date": "2026-10-14",
  "operator": "Lucas",
  "size": "20×30",
  "rows": [
    {
      "bobbin": 1,
      "product": "Sacola Prata",
      "size": "20×30",
      "start": "11:50",
      "end": "14:37",
      "qty": 5150,
      "stops": null,
      "notes": "Cruza o almoço: pausa não quantificada.",
      "uncertain": false
    },
    {
      "bobbin": 2,
      "product": "Sacola Rosa Bebê",
      "size": "20×30",
      "start": "14:45",
      "end": "",
      "qty": 2150,
      "stops": null,
      "notes": "Horário de finalização não informado.",
      "uncertain": true
    }
  ],
  "warnings": [
    "Horário de finalização da bobina 2 não identificado na ficha."
  ]
}
```

**Estes números são somente exemplo de estrutura, não uma transcrição da foto atual.** Não use o arquivo de exemplo como produção real.

Os campos `date` e `operator` são obrigatórios para **salvar no histórico**, mas sua ausência não impede a visualização de uma prévia. Não inserir dados fictícios só para viabilizar o salvamento. O campo `end` pode ficar vazio sem impedir o salvamento de uma bobina com identidade válida. O sistema recalcula indicadores excluindo tempos de almoço sem pausa definida e horas finais ausentes.

## Checagem antes de gerar um arquivo

1. Transcrever todas as bobinas que foram preenchidas, sem duplicar nem pular dados legíveis.
2. Conferir as relações entre campos da mesma bobina.
3. Indicar claramente pontos em que não foi possível ler.
4. Salvar como UTF-8 `.json`, não colar Markdown dentro do arquivo.
5. Importar na aba do SANPA Controle e **revisar o dashboard antes de aprovar**.
6. O histórico aprovado fica no `localStorage['sanpa-prod-2026']` desse navegador, não sincroniza entre computadores. Fazer backups JSON periódicos.
