// English presentation of the built-in investigation narratives, including saved results.
// Free-form mission protocol references and custom routines retain their original text.
const builtInCopy: Record<string, string> = {
  "Sem padrão pela regra da demo": "No pattern under the demo rule",
  "Padrão experimental a verificar": "Experimental pattern to check",
  "Dados insuficientes": "Insufficient data",
  "Seguir protocolo da missão": "Follow mission protocol",
  "Regra experimental de software com dados fictícios; não é avaliação clínica.": "This experimental rule uses simulated data. Clinical assessment is outside its scope.",
  "Período de sono aproximado pela data UTC; o resultado depende da janela e dos dados usados.": "UTC dates approximate sleep periods. The result depends on the observation window and available data.",
  "Este detector individual não avalia padrões coletivos nem causalidade ambiental.": "This detector evaluates individual patterns only.",
  "Leituras suspeitas foram excluídas da evidência.": "Suspect readings were excluded from the evidence.",
  "É necessária uma baseline sintética de sono positiva para avaliar a regra.": "The rule requires a positive simulated sleep baseline.",
  "Há dados suficientes, sem padrão pela regra individual de sono da demo.": "The individual sleep rule found no pattern in the available data.",
  "Sem dois perfis com períodos de sono comparáveis para relacionar o ambiente.": "At least two crew members with comparable sleep periods are needed to evaluate environmental context.",
  "Faltam leituras ambientais utilizáveis em ambos os períodos comparáveis.": "Comparable valid environmental readings are missing.",
  "Não há leitura ambiental anterior para servir de referência na janela.": "An earlier environmental reading is needed as a reference for this window.",
  "Duas leituras comparáveis variam na mesma direção frente à referência; coincidência não estabelece causalidade.": "Two comparable readings shifted in the same direction relative to the reference. The cause remains unknown.",
  "As leituras não sustentam uma mudança consistente frente à referência.": "The readings show no consistent change relative to the reference.",
  "São necessários pelo menos dois perfis com sono suficiente nos mesmos dois períodos UTC.": "At least two crew members need usable sleep readings from the same two UTC periods.",
  "Sem padrão coletivo pela regra da demo; alterações individuais permanecem nos resultados de cada perfil.": "The demo rule found no crew pattern. Individual findings remain available by crew member.",
  "Coincidência temporal com mudança de CO₂ interno": "Timing overlaps a change in cabin CO₂",
  "O padrão de sono e as leituras de CO₂ são temporalmente comparáveis; os dados não demonstram causalidade.": "The sleep pattern and cabin CO₂ readings overlap in time. Their causal relationship remains unconfirmed.",
  "Explicações alternativas ainda não verificadas": "Unconfirmed alternative explanations",
  "Rotina compartilhada, fatores individuais e condições da coleta também podem contribuir; os dados disponíveis não distinguem essas possibilidades.": "Shared routines, individual factors, and collection conditions could also contribute. The available data cannot distinguish these possibilities.",
  "Regra experimental com tripulação fictícia; não é avaliação clínica nem diagnóstico.": "This experimental rule uses a simulated crew. Clinical assessment and diagnosis are outside its scope.",
  "Datas UTC aproximam os períodos de sono. Só o par comparável mais recente é avaliado coletivamente.": "UTC dates approximate sleep periods. The crew analysis uses the latest comparable pair.",
  "Coincidência ambiental não demonstra causalidade; temperatura permanece contexto descritivo.": "Environmental overlap leaves the cause unconfirmed. Temperature provides descriptive context.",
  "Qualidade suspeita, ausência de referência ou incompatibilidade temporal limitam a evidência ambiental sem apagar achados de sono.": "Suspect readings, missing references, and incompatible timestamps limit the environmental evidence. Sleep findings remain available.",
  "AKM Health · Arquitetura e regras da demonstração": "AKM Health · Demo architecture and rules",
  "Define a comparação de sono e os critérios experimentais da análise.": "Defines the sleep comparison and the experimental criteria.",
  "NASA Human Research Roadmap · Sono, ritmo circadiano e carga de trabalho": "NASA Human Research Roadmap · Sleep, circadian rhythms, and workload",
  "Contextualiza o monitoramento do sono em missão. O critério da demo vem da arquitetura AKM.": "Provides context for monitoring sleep on missions. The AKM architecture defines the demo rule.",
  "AKM Health · Critérios de alerta e revisão humana": "AKM Health · Alert criteria and human review",
  "Explica quando levar a análise à equipe e como seguir o protocolo da missão.": "Explains when to contact mission staff and how to follow the mission protocol.",
  "A investigação descreve dados da demonstração. A avaliação clínica cabe à equipe responsável.": "This investigation describes demo readings. Clinical assessment belongs to mission staff.",
  "Este registro não fornece detalhes auditáveis da cobertura da análise.": "The saved record lacks auditable details about coverage.",
  "A cobertura das leituras é insuficiente para avaliar o padrão de sono neste escopo.": "This scope lacks enough readings to assess the sleep pattern.",
  "A causa do padrão de sono permanece em aberto.": "The cause of the sleep pattern remains unknown.",
  "O resultado se limita ao padrão de sono avaliado, aos perfis cobertos e à janela das leituras.": "The result applies to the evaluated sleep pattern, profiles, and observation window.",
  "A interpretação operacional do registro cabe à equipe da missão.": "Mission staff are responsible for interpreting the record operationally.",
  "O CO₂ considerado é o do ar interno da cabine.": "The CO₂ readings describe cabin air.",
  "NASA OCHMO-TB-004 · Dióxido de carbono": "NASA OCHMO-TB-004 · Carbon dioxide",
  "Contextualiza a observação do ar da cabine. As leituras da investigação vêm da demonstração.": "Provides cabin-air context. The investigation uses demo readings.",
  "Procure o responsável designado pelo protocolo da missão sem aguardar nova coleta.": "Contact the person designated by the mission protocol immediately.",
  "Se o padrão persistir após a rechecagem, as coletas repetidas falharem ou você precisar de ajuda, leve o escopo da investigação, as leituras, os horários, a qualidade, as lacunas e as verificações já feitas à equipe responsável.": "If the pattern persists after a follow-up, repeated collections fail, or you need help, share the scope, readings, timestamps, quality, gaps, and completed checks with mission staff.",
  "Se o protocolo indicar encaminhamento imediato, procure o responsável designado sem aguardar reanálise.": "If the protocol calls for immediate referral, contact the designated person immediately.",
  "Registrar sono em um período distinto para reduzir a lacuna de evidência do perfil; uma repetição do mesmo período não completa a cobertura.": "Record sleep for a different period to fill the evidence gap. Repeated readings for the same period add no coverage.",
  "Repetir o registro de sono e conferir horário/rotina de coleta para acompanhar o padrão individual experimental.": "Record another sleep period and check collection timing to follow up on the individual pattern.",
  "Seguir o encaminhamento humano do protocolo validado informado, sem aguardar nova coleta.": "Follow the validated protocol for immediate human referral.",
  "Checagem permitida pelo protocolo validado informado:": "Check permitted by the validated protocol:",
  "Confirmar nova leitura de CO₂ interno e conferir horário/qualidade da coleta; a coincidência ambiental não demonstra causalidade.": "Collect another cabin CO₂ reading and check its timestamp and quality. The cause remains unconfirmed.",
  "Obter contexto adicional da temperatura interna; não substitui a confirmação de CO₂.": "Collect cabin temperature for additional context. A separate CO₂ reading is still needed for confirmation.",
  "Registrar um novo período distinto de sono para alinhar a cobertura temporal coletiva.": "Record sleep for another distinct period to align the crew observation windows.",
  "Não há checagem relevante disponível; conferir recursos ou solicitar revisão humana, sem inventar uma alternativa.": "No relevant check is available. Review resources or request human review.",
  "Sem checagem adicional pela regra da demo; as avaliações programadas continuam nas tarefas de rotina.": "The demo rule suggests no additional check. Scheduled checks remain in the routine.",
  "Conferir perfis, baselines e cobertura temporal: não há alvo adequado para uma nova coleta informativa.": "Review crew profiles, baselines, and time coverage. There is no suitable target for an additional reading.",
  "Alternativa viável: as opções anteriores na priorização estão indisponíveis.": "The higher-priority checks are unavailable. This check is the next viable option.",
  "Limitação:": "Limitation:",
  "Rotina demonstrativa:": "Demo routine:",
  "Referência:": "Reference:",
  "Registrar o sono do período concluído.": "Record sleep for the completed sleep period.",
  "Registrar uma leitura pontual em condição comparável; repouso não é verificado pelo app.": "Record one reading under comparable conditions. Resting conditions are outside the app's verification scope.",
  "Registrar o check-in subjetivo diário da demonstração.": "Record the daily subjective check-in.",
  "Registrar o CO₂ interno na janela ambiental demonstrativa.": "Record cabin CO₂ during the demo collection window.",
  "Registrar a temperatura interna na janela ambiental demonstrativa.": "Record cabin temperature during the demo collection window.",
  "AKM-06; janela diária UTC escolhida somente para a demo AKM-25": "AKM-06, using the UTC daily window chosen for the AKM-25 demo",
};

const phrases = new RegExp(
  Object.keys(builtInCopy).sort((a, b) => b.length - a.length)
    .map(phrase => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'gu',
);

export function englishMissionCopy(text: string): string {
  return text.replace(/Janela observada: (\S+) a (\S+)\.$/gm, 'Observation window: $1 to $2.')
    .replace(/Há (\d+) período\(s\) de sono utilizável\(is\) na janela; são necessários dois períodos distintos\./g,
      '$1 usable sleep periods in the window. The rule requires two distinct periods.')
    .replace(/As duas observações de sono são menores ou iguais a ([0-9.]+)% da baseline sintética: padrão experimental a verificar\./g,
      'Both sleep observations are at or below $1% of the simulated baseline. Check this experimental pattern.')
    .replace(/Padrão experimental de sono compartilhado por (\d+) astronautas: /g, 'Experimental sleep pattern shared by $1 crew members: ')
    .replace(phrases, phrase => builtInCopy[phrase]);
}
