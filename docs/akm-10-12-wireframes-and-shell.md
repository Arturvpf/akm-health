# AKM-10 e AKM-12 · Protótipo e navegação da ODYSSEY-26

[AKM-10 · Wireframes](https://app.notion.com/p/4189432b222281dbb9d5fc545c36a209) · [AKM-12 · Shell](https://app.notion.com/p/4189432b222281f0aabcdad196a6a083) · [Brief de UX](https://app.notion.com/p/4189432b222281f195b5d4f9926ce93a) · [Fluxo de investigação](akm-04-investigation-flow.md)

## AKM-10 · Protótipo navegável

Abra [o HTML do wireframe](../frontend/public/akm-10-wireframe.html) diretamente no navegador ou pelo link do shell. Dashboard, Registrar, Histórico e Investigação compartilham dados fictícios mantidos em memória. O seletor de cenário permite exercitar dados sintéticos, carregamento, ausência de dados e falha de conexão. O histórico indica a origem das observações, mantém leituras suspeitas na tabela e mostra duração do sono por dia UTC com baseline individual e lacunas explícitas.

1. Em Registrar, tente informar 25 h de sono e confira a mensagem e a preservação do valor. Registre um valor válido e consulte a tabela do Histórico.
2. Em Investigação, execute o cenário coletivo. Confira o achado, as fontes, a hipótese não confirmada e a próxima verificação. A conclusão fica desabilitada até registrar uma nova leitura compatível.
3. Registre a rechecagem de CO₂, conclua a verificação e reanalise. Confira que a medição vinculada aparece entre as evidências. Repita no escopo individual de Aurora usando uma leitura de sono.
4. Teste o cenário sem dados e o carregamento no seletor superior. Simule uma falha de conexão após uma investigação e confira que o último resultado continua visível.
5. Alterne do coletivo para o individual e volte. Confira que a verificação coletiva continua registrada no seu escopo. Com uma leitura compatível salva, tente concluir durante a falha simulada e confira que só é possível concluir depois da reconexão.
6. No cenário sem dados, registre duas leituras de sono do mesmo perfil no mesmo dia e verifique que o coletivo continua com dados insuficientes.
7. Navegue por teclado e confira o foco após mudar um filtro e ao entrar no gráfico e na tabela roláveis. Verifique as quatro telas a partir de 320 px.
8. Gere uma verificação coletiva, mude para Lyra no escopo individual e volte ao Dashboard. A pendência coletiva deve continuar visível e seu botão deve abrir o acompanhamento coletivo. Gere também verificações individuais de Aurora e Orion: o contador deve mostrar três pendências, sem duplicar a selecionada. Concluir uma delas deve preservar as demais.

O Dashboard reúne as verificações pendentes guardadas por escopo com a seleção atual, que pode ter alterações ainda não guardadas pela troca de escopo. Cada item identifica o escopo ou tripulante e abre o acompanhamento correspondente. O reset do cenário limpa essa agenda simulada. A regressão automatizada executa o script original do HTML por seus eventos em um DOM mínimo; ela verifica a lógica e o HTML gerado, sem substituir a inspeção visual no navegador.

## AKM-12 · Shell React

```sh
npm --prefix frontend ci
npm --prefix frontend run test:navigation
npm --prefix frontend run test:wireframe
npm --prefix frontend run build
npm --prefix frontend run dev
```

Abra `http://127.0.0.1:5173/`. As quatro rotas `#/dashboard`, `#/registrar`, `#/historico` e `#/investigacao` mostram dados demonstrativos no React. O Dashboard apresenta a tripulação e a cabine, Registrar exibe um payload de exemplo, Histórico apresenta leituras e qualidade, e Investigação separa achado, evidência, hipótese e próxima checagem. A integração de cada tela com a API pertence às AKM-13 a AKM-16. O wireframe abre a partir de uma única cópia em `frontend/public/`.

Os links suportam navegação direta, voltar e avançar. O item ativo usa `aria-current` e a troca de página transfere o foco para o conteúdo principal. Hashes desconhecidos exibem o Dashboard.
