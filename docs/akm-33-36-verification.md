# AKM-33 a AKM-36 — Registro de verificação e handoff

**Base:** ZIP `akm-health-main.zip` fornecido para esta execução (conteúdo extraído sem sobrescrever o repositório remoto).

## Entregas por tarefa

| Tarefa | Arquivos principais | Implementação |
|---|---|---|
| AKM-33 | `backend/app/offline_sync.py`, `models.py`, `db.py`, `schemas.py`, `main.py`; `frontend/src/offline-store.ts`, `OfflineStatus.tsx`, `public/sw.js` | Outbox persistente por operação, reenvio com UUID fixo, idempotência do servidor, detecção de conflitos, cache explícito, rascunho local |
| AKM-34 | `frontend/src/ScenarioComparator.tsx`, `scenario-data.ts` | Comparações aritméticas de 5 métricas sobre seed sintético imutável, premissas e ausências explícitas |
| AKM-35 | `frontend/src/EnvironmentView.tsx`, `environment-data.ts` | 4 ambientes hipotéticos, referências NASA, contexto variável, motor clínico intocado |
| AKM-36 | `frontend/src/BodyExplorer.tsx`, `experiments.css` | Silhueta vetorial, controles nativos acessíveis por teclado, associação dos indicadores com limites explícitos |

Outros arquivos modificados: `frontend/src/App.tsx`, `navigation.ts`, `measurement-api.ts`, `MeasurementForm.tsx`, `api.ts`, `history-data.ts`, `investigation-api.ts`, `OfflineStatus.tsx`, `frontend/package.json`, `README.md`, `docs/database.md`, `backend/tests/test_database.py`.

## O que foi verificado neste ambiente

| Teste | Resultado |
|---|---|
| `python -m compileall -q backend` | **APROVADO** — sintaxe Python válida |
| `tsc --noEmit` nos módulos TypeScript puros de contrato, dados e outbox | **APROVADO** |
| `node frontend/scripts/test-p2-experiments.cjs` | **APROVADO** — gravidade/contexto e valores simulados |
| `node frontend/scripts/test-p2-offline.cjs` | **APROVADO** — persistência simulada, resposta de rede perdida, recibo e retenção de conflito |
| Parsing de todos os `.ts`/`.tsx` via TypeScript | **APROVADO** — zero erros de parsing |
| `python -m pytest -q backend` | **NÃO EXECUTADO** — dependência `sqlmodel` ausente e instalação bloqueada por falta de rede |
| `npm --prefix frontend ci`, `npm run build` | **NÃO EXECUTADO** — `node_modules` React/Vite indisponíveis neste ambiente |
| Navegador Chromium real / E2E do IndexedDB | **BLOQUEADO** — navegação HTTP e file pelo Chromium bloqueada pelo ambiente; há teste unitário simulado, mas ele não substitui E2E |

Resultados de testes unitários não substituem o teste real com backend, banco e navegador. Não apresentar estas tarefas como aprovadas pelo QA antes dessas verificações.

## Validação para a equipe (quando houver ambiente com dependências)

1. Faça backup do SQLite existente e instale as dependências do projeto.
2. Inicie FastAPI e execute `python -m pytest -q backend`. Testes AKM-33 cobrem migração v1, reexecução, conflito e concorrência.
3. Rode `npm --prefix frontend ci`, `npm --prefix frontend run build`, `npm --prefix frontend run test:p2` e `npm --prefix frontend run test:offline`.
4. Execute `npm --prefix frontend run preview`; carregue pelo menos uma vez para instalar Service Worker.
5. Desligue a API e registre medição fictícia; recarregue o navegador; verifique fila preservada; reative a API e sincronize; confira contagem 1 e receipt 201/200.
6. Force envio do mesmo UUID com corpo diferente: HTTP 409, item retido no outbox, exportação JSON disponível.
7. Visite `#/comparador`, `#/ambientes` e `#/corpo`, inclusive no celular e usando **somente teclado**.
8. Confirme que os dados NASA reais não aparecem como medições da tripulação e que mudar de ambiente não altera os estados de saúde ou as tabelas principais.

## Riscos e limites remanescentes

- Apenas **registros novos de medição** são enfileirados automaticamente em AKM-33. Investigação e conclusão de follow-up requerem a API online, para evitar execução sobre contexto possivelmente desatualizado. A equipe deve decidir se a aceitação oficial da AKM-33 requer também esses dois tipos de ação offline; se requer, há trabalho adicional.
- IndexedDB depende de políticas e capacidade do navegador; não existe garantia absoluta após limpeza manual, quota esgotada ou troca de dispositivo. Operação com erro de armazenamento não é enviada ao servidor.
- Ambientes selecionados são **contextos hipotéticos**, não dados de sensores nem alteração da missão ativa.
- Um atlas esquemático não é um instrumento diagnóstico e não apresenta leituras corporais reais.
- Conteúdo científico contextual da NASA sustenta os tipos de perigos, não valida heurísticas clínicas ou números sintéticos.
