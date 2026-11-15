# AKM-33 — Persistência offline, reconexão e resolução explícita de conflitos

**Status:** implementação técnica entregue para revisão, não uma certificação de confiabilidade clínica.

## Princípio de segurança

Um POST repetido após perda da resposta pode duplicar uma leitura, mesmo que o servidor tenha salvo o primeiro POST. Para impedir isso, o cliente atribui um UUID estável a cada **operação de registro**, persiste essa operação no IndexedDB **antes da primeira chamada de rede** e utiliza `POST /api/sync/measurements` para todas as tentativas de sincronização de registros feitos pela interface. O servidor associa o UUID ao SHA-256 do conteúdo validado e ao ID da medição em uma transação SQLite única.

- **201**: leitura criada e operação registrada; cliente aceita comprovante e exclui da fila local.
- **200**: UUID já processado com mesmo conteúdo; servidor retorna o ID original (`reused: true`), sem duplicar medição.
- **409**: mesmo UUID com conteúdo diferente; conflito permanente, sem sobrescrever a medição anterior.
- **404/422**: registro inválido ou sujeito ausente; pendência exibida como conflito, sem descartar dados locais.
- **Rede/5xx/recibo inválido/timeout**: manter o registro e o mesmo UUID; reenvio posterior é seguro.

## Componentes

| Componente | Responsabilidade |
|---|---|
| `frontend/src/offline-store.ts` | IndexedDB v1, snapshots cacheados, outbox, reenvios e confirmação durável |
| `frontend/src/OfflineStatus.tsx` | Pendentes, conflitos, exportação JSON e sincronização manual/automática |
| `frontend/public/sw.js` | Cache de shell e recursos locais em produção; **nunca cache automático de `/api`** |
| `frontend/src/measurement-api.ts` | Interface usa `durableSaveMeasurement`; helper legado `saveMeasurement` mantido só para compatibilidade e testes antigos |
| `backend/app/offline_sync.py` | Transação idempotente, validação e controle de conflitos |
| `backend/app/models.py` | Nova tabela auxiliar `sync_operations` |
| `backend/app/db.py` | Migração **schema v1→v2**, preservando dados anteriores |
| `backend/tests/test_akm33_sync.py` | Replays, conflito, timestamps, migracão e concorrência |

### Migração e backup

O MVP original usava 4 tabelas e `PRAGMA user_version=1`. A extensão P2 usa **5 tabelas** (as 4 originais e `sync_operations`), com `user_version=2`. Nenhuma medição original precisa ser modificada. A migração é executada no startup ou `cd backend && python -m app.db`.

**Antes de atualizar** o banco local existente, feche o servidor e faça backup: `cp backend/akm.db backend/akm.db.bak-antes-akm33`. Caso o esquema não seja reconhecido, a migração deve falhar em vez de criar estruturas incompatíveis.

## Demonstração offline → online

1. Inicie o back-end e o front-end em modo de produção local (`npm run build` e `npm run preview`), execute o seed e visite a aplicação ao menos uma vez com a rede funcional para armazenar o shell no navegador.
2. Deixe o back-end indisponível e registre uma leitura **fictícia**; o formulário mostra a operação salva localmente, e a faixa global mostra 1 pendente.
3. Atualize a página sem restabelecer a API. O IndexedDB deve manter a pendência. O formulário também persiste o rascunho em `localStorage`.
4. Reative o servidor e clique **Sincronizar agora**. A pendência deve passar a zero e aparecer uma nova linha no histórico.
5. Simule perda da resposta depois de o servidor gravar; reenvie o mesmo UUID e o mesmo conteúdo: receba 200, `reused=true`, com **um único ID de medição** no banco.
6. Reenvie o mesmo UUID com valor diferente: receba 409, a fila deve registrar o conflito e mostrar a opção de **exportar o JSON** sem eliminar a leitura.

## Limitações importantes

- Esta implementação assegura idempotência **para leituras enviadas pelo endpoint `/api/sync/measurements`**. O endpoint antigo `POST /api/measurements` permanece disponível para clientes legados e **não** recebe essa garantia.
- A interface cacheia respostas de dashboard, histórico, perfis e agendas já consultadas e sinaliza quando usa uma cópia possivelmente desatualizada. Sem uma primeira visita online, não há dados para consulta offline. Os resultados não são gerados artificialmente.
- A fila de escrita automática cobre **novas medições**. Investigações e conclusão de follow-ups dependem do servidor e não são executadas ou inventadas offline; fazê-las sobre um estado potencialmente desatualizado exigiria especificação adicional. Esse limite deve ser apresentado à equipe antes de aceitar a tarefa como "offline completo" em todos os fluxos.
- Persistência no IndexedDB depende das políticas do navegador, quota e limpeza manual de dados. A opção de exportar a fila protege contra alguns riscos; não equivale a backup garantido.
- Sem autenticação, não sincronizar dados de saúde de pessoas reais. Todos os registros são fictícios ou manuais de demonstração. Não confundir `quality=ok` com saúde normal.

**NASA:** referência de autonomia e distância à Terra em https://www.nasa.gov/hrp/hazards/ ; não são regras de triagem médica.
