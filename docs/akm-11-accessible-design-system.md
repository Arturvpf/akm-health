# AKM-11 · Design system acessível

[Tarefa AKM-11](https://app.notion.com/p/4189432b2222817e8547e572a324daab) · [Brief de UX](https://app.notion.com/p/4189432b222281f195b5d4f9926ce93a) · [Critérios de alerta](akm-08-alert-safety.md) · [Catálogo de alerta](akm-24-alert-presentation.md)

Os tokens em `frontend/src/styles.css` definem superfícies, texto, cores semânticas, foco, tipografia, espaçamento e alvos de interação. A escala tipográfica vai de 0,75 rem a 2,625 rem. O espaçamento usa múltiplos de 0,25 rem. A navegação, os botões e o seletor têm altura mínima de 2,75 rem.

| Componente em `frontend/src/design-system.tsx` | Aplicação |
| --- | --- |
| `Card`, `ActionLink`, `SimulationNotice` | Cartões, links e aviso de simulação nas quatro rotas |
| `Details`, `DataTable`, `SourceBadge`, `QualityBadge` | Unidades e coleta em Registrar, tabela rolável no Histórico, qualidade e origem por rótulo |
| `SelectField`, `ActionButton`, `DataState` | Seletor com rótulo nativo, ações e mensagens de estado na demonstração |
| `StatusBadge`, `ProtocolLegend` | Classificação experimental e legenda na Investigação |

Cada estado comunica significado por rótulo e ícone. O ícone repete a informação do texto e fica oculto para leitores de tela. As classificações do motor usam verde para `normal`, amarelo para `attention` e cinza para `insufficient_data`. O vermelho de `critical` é reservado à legenda do protocolo P0. O componente de resultado aceita os três estados experimentais.

Vazio, carregamento, falha de conexão e atualização concluída são estados da interface. A região de feedback anuncia essas mudanças e o foco volta ao seletor após concluir ou tentar novamente. Em carregamento ou falha simulada, o último resultado selecionado conserva seu rótulo, origem e horário UTC. Os cenários vazio e de dados insuficientes oferecem um link para Registrar. Na integração do formulário, preservar valores em caso de erro, apontar o campo inválido em respostas 422 e associar a mensagem ao campo.

## Reproduzir

```sh
npm --prefix frontend ci
python scripts/check.py
npm --prefix frontend run test:navigation
npm --prefix frontend run test:wireframe
npm --prefix frontend run build
npm --prefix frontend run dev
```

1. Abra [o shell local](http://127.0.0.1:5173/#/dashboard). Confira a origem explícita da tripulação e do habitat e a referência científica NASA em outra seção. Em Registrar, confira unidade, zona, horário UTC e origem. No Histórico, localize a leitura suspeita com seu ícone e rótulo.
2. Abra Investigação e selecione os três resultados. **Padrão a verificar** reproduz o cenário coletivo com três perfis afetados, hipótese ambiental não confirmada e proposta de nova leitura de CO₂. **Sem padrão coletivo** usa as leituras comparáveis do cenário individual no escopo de tripulação. Apenas Aurora atende ao critério individual. **Dados insuficientes** reproduz a cobertura de um único perfil da fixture insuficiente. Confira o rótulo, o ícone e a origem simulada no cartão de cada resultado. Os exemplos usam horários fictícios e o vermelho aparece apenas na legenda. [Cenários sintéticos](../backend/tests/fixtures/odyssey-26-scenarios.json)
3. No seletor, percorra **Sem observações**, **Carregamento** e **Falha de conexão**. O vazio mostra o caminho para adicionar uma medição. Após selecionar qualquer resultado, confira que ele e seu horário continuam à vista durante a falha, o carregamento e após concluir a atualização pelo botão.
4. Teste a partir de 320 px. Use Tab e Enter no link de pular para o conteúdo e nos links de navegação. Confira o foco do conteúdo após mudar de rota. No Histórico, use Tab até a região da tabela e as setas para rolar horizontalmente. Teste voltar e avançar e abra o wireframe pelo link do shell.

O build foi verificado no Edge em 320, 768 e 1280 px. O axe não reportou violações WCAG A/AA nas quatro rotas e nos estados demonstrados. O teste de teclado verificou navegação, foco, rolagem da tabela e ações de atualização. As razões de contraste medidas entre texto e fundo dos estados foram 8,70:1 (informação), 8,74:1 (neutro), 7,34:1 (positivo), 7,53:1 (atenção) e 7,59:1 (protocolo). As ações de navegação medidas ficaram acima de 6,6:1. [Contraste mínimo](https://www.w3.org/TR/WCAG22/#contrast-minimum) · [Reflow](https://www.w3.org/TR/WCAG22/#reflow)

O [wireframe AKM-10](akm-10-12-wireframes-and-shell.md) é a demonstração em memória do registro, da investigação e da rechecagem. A integração da API com o shell React pertence às AKM-13 a AKM-16.
