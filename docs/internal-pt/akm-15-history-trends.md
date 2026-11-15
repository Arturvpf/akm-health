# AKM-15 · Histórico e tendências

Tarefa AKM-15 (internal Notion page; Portuguese, not part of the submission) · [Contrato de leitura AKM-19](../akm-19-read-apis.md)

O Histórico carrega os perfis e a base individual de sono por `GET /api/astronauts`. A primeira consulta mostra o sono do primeiro perfil disponível. Se a lista estiver vazia, começa pelo CO₂ do habitat. Em cada consulta, o indicador acompanha o alvo selecionado. Sono, frequência cardíaca e humor usam o ID do tripulante. CO₂ e temperatura usam o indicador do habitat. O cliente lê as páginas de `GET /api/measurements` em ordem até receber uma página curta.

As datas opcionais delimitam a coleta em UTC, com os dias inicial e final inteiros incluídos. O gráfico exibe o período aplicado e informa o intervalo das observações disponíveis. Um dia UTC sem coleta é indicado como lacuna, inclusive nas extremidades quando o filtro define essas datas. A linha é interrompida em lacunas e leituras suspeitas. Cada leitura suspeita permanece como um × no gráfico e como uma linha identificada na tabela. A tabela oferece os valores, unidades, horários de coleta e registro, origem e qualidade de todas as observações. A base de sono vem do perfil simulado e serve como referência descritiva. A qualidade indica a condição técnica da leitura.

O carregamento é anunciado e uma nova consulta cancela a anterior. A mensagem de vazio oferece um link para Registrar. Em caso de falha, a ação **Tentar novamente** repete a consulta com os filtros aplicados, preservando os campos preenchidos. Qualquer página com erro invalida a consulta inteira. Datas fora de ordem mantêm a consulta anterior e encaminham o foco para o fim do período.

## Como reproduzir

Com as dependências instaladas pelo README, execute `python -m app.seed` em `backend/`. A partir da raiz, inicie a API e o frontend em terminais separados.

```sh
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
npm --prefix frontend run dev
```

1. Abra [Histórico local](http://127.0.0.1:5173/#/historico). O seed exibe Aurora com 5,2 h e 5,4 h de sono e base de 8 h.
2. Escolha Lyra e **Frequência cardíaca**, filtre de 13/11/2026 a 14/11/2026 e aplique. A tabela mostra 66 bpm no dia 13 e o gráfico indica a ausência de amostra no dia 14. Escolha um período anterior ao seed para ver o estado vazio.
3. Limpe as datas, selecione **Habitat** e **CO₂ interno**, e aplique. A leitura de 2.200 ppm aparece como suspeita e a tabela identifica sua origem simulada. Alterne para **Temperatura da cabine** para conferir a unidade em °C.
4. Pare a API e reaplique os filtros para ver a falha. Suba a API e use **Tentar novamente**. Em uma janela de 320 px, percorra os filtros com Tab e use as setas nas regiões roláveis do gráfico e da tabela.

```sh
node --test frontend/scripts/test-history.cjs
python -m pytest -q backend/tests/test_history_api.py
npm --prefix frontend run test:navigation
npm --prefix frontend run test:wireframe
npm --prefix frontend run build
```
