/**
 * ============================================================
 * KUWERENGA+: Serviço de Dicionário Lusófono de Alta Precisão
 * ============================================================
 * Sistema multinível de consulta lexical e contextual para o ambiente de leitura:
 * 1. Cache Local Persistente (0ms)
 * 2. Léxico Literário e Filosófico Curado Embutido (Offline instantâneo)
 * 3. Desanexação Morfológica e Ênclise em Português (escrevê-lo -> escrever, viu-se -> ver)
 * 4. Wikcionário da Língua Portuguesa (Definições modernas, classes, exemplos e sinónimos)
 * 5. Resolução Automática de Formas Flexionadas (Verbos conjugados, plurais, femininos)
 * 6. Dicionário Aberto da Língua Portuguesa (Fonte complementar)
 * 7. Wikipédia Lusófona (Termos enciclopédicos, entidades e conceitos)
 * 8. Explicador de IA Contextual (Gemini se chave configurada)
 */

export interface DefinitionResult {
  term: string;
  type: "word" | "phrase";
  baseForm?: string;
  inflectionNote?: string;
  grammaticalClass?: string;
  etymology?: string;
  definitions: string[];
  examples?: string[];
  synonyms?: string[];
  source: "wiktionary" | "dicionario" | "wikipedia" | "local" | "gemini";
  summary?: string;
}

const DICT_CACHE_PREFIX = "kuwerenga_dict_v2_";

/**
 * Léxico curado embutido de termos literários, filosóficos e de alta frequência na leitura
 */
const LOCAL_CURATED_LEXICON: Record<string, Omit<DefinitionResult, "term">> = {
  "resiliência": {
    type: "word",
    grammaticalClass: "Substantivo feminino",
    etymology: "Do latim resilire, 'saltar para trás, retornar ao estado original'",
    definitions: [
      "Propriedade de um corpo de recuperar a sua forma ou estado original após cessar a deformação elástica sofrida.",
      "Capacidade psicológica e emocional de resistir, adaptar-se e superar situações de crise, choque ou adversidade extrema."
    ],
    examples: ["A resiliência da protagonista diante dos infortúnios sustentou toda a narrativa."],
    synonyms: ["resistência", "superação", "fortaleza", "adaptabilidade"],
    source: "local"
  },
  "cativante": {
    type: "word",
    grammaticalClass: "Adjetivo de dois géneros",
    etymology: "Particípio do verbo cativar",
    definitions: [
      "Que é capaz de cativar, encantar ou seduzir; que desperta admiração e simpatia irresistível.",
      "Que prende a atenção do leitor de maneira agradável e envolvente."
    ],
    examples: ["O livro possui um enredo cativante do primeiro ao último capítulo."],
    synonyms: ["encantador", "fascinante", "atraente", "sedutor", "envolvente"],
    source: "local"
  },
  "efêmero": {
    type: "word",
    grammaticalClass: "Adjetivo",
    etymology: "Do grego ephēmeros, 'que dura apenas um dia'",
    definitions: [
      "Que é de curta duração; passageiro, transitório, que dura pouco tempo.",
      "Em botânica ou zoologia, organismo que possui ciclo biológico muito breve."
    ],
    examples: ["A glória mundana revelou-se tão efêmera quanto o orvalho da manhã."],
    synonyms: ["fugaz", "passageiro", "transitório", "perecível", "breve"],
    source: "local"
  },
  "altruísmo": {
    type: "word",
    grammaticalClass: "Substantivo masculino",
    etymology: "Do francês altruisme, derivado do italiano altrui, 'do outro'",
    definitions: [
      "Amor desinteressado ao próximo; disposição e conduta que prioriza o bem-estar e interesse dos outros.",
      "Antítese do egoísmo; dedicação generosa e abnegação em favor da comunidade."
    ],
    examples: ["O seu altruísmo transformou a realidade daquela aldeia."],
    synonyms: ["filantropia", "generosidade", "abnegação", "benevolência"],
    source: "local"
  },
  "empatia": {
    type: "word",
    grammaticalClass: "Substantivo feminino",
    etymology: "Do grego empatheia, 'paixão, afeição íntima'",
    definitions: [
      "Capacidade de se identificar e compreender os sentimentos, perspetivas e emoções de outra pessoa.",
      "Aptidão emocional de colocar-se no lugar do outro perante determinado contexto."
    ],
    examples: ["A literatura estimula a empatia ao permitir-nos viver vidas distintas da nossa."],
    synonyms: ["compreensão", "sensibilidade", "afinidade", "compaixão"],
    source: "local"
  },
  "utopia": {
    type: "word",
    grammaticalClass: "Substantivo feminino",
    etymology: "Do grego ou, 'não', e topos, 'lugar': 'lugar que não existe'",
    definitions: [
      "Conceção de uma sociedade ideal, perfeita e harmoniosa, onde os indivíduos vivem em plena equidade e felicidade.",
      "Ideia ou projeto grandioso, nobre, mas de difícil ou impossível concretização prática."
    ],
    examples: ["A obra de Thomas More inaugurou o conceito moderno de utopia política."],
    synonyms: ["quimera", "ideal", "ilusão", "sonho", "fantasia"],
    source: "local"
  },
  "distopia": {
    type: "word",
    grammaticalClass: "Substantivo feminino",
    etymology: "Do grego dys, 'mau, difícil', e topos, 'lugar'",
    definitions: [
      "Representação ficcional ou filosófica de uma sociedade opressiva, totalitária e desumanizada, dominada pelo medo e controlo extremo.",
      "O oposto da utopia; advertência sobre os perigos do autoritarismo e da tecnologia sem limites éticos."
    ],
    examples: ["Livros como '1984' e 'Fahrenheit 451' são marcos clássicos da ficção distópica."],
    synonyms: ["antiutopia", "pesadelo social", "regime opressivo"],
    source: "local"
  },
  "pragmático": {
    type: "word",
    grammaticalClass: "Adjetivo",
    etymology: "Do grego pragmatikos, 'ativo, prático, experiente'",
    definitions: [
      "Que valoriza a utilidade prática e os resultados concretos em detrimento de teorias ou especulações puras.",
      "Pessoa realista, eficiente e objetiva no tratamento de questões quotidianas ou políticas."
    ],
    examples: ["Ele adotou uma postura pragmática para resolver o conflito sem delongas."],
    synonyms: ["prático", "realista", "objetivo", "funcional", "utilitário"],
    source: "local"
  },
  "paradoxo": {
    type: "word",
    grammaticalClass: "Substantivo masculino",
    etymology: "Do grego paradoxos, 'contrário à opinião comum'",
    definitions: [
      "Pensamento, proposição ou situação que reúne ideias aparentemente contraditórias, mas que encerra uma verdade profunda.",
      "Falta de nexo ou coerência aparente; contradição conceitual."
    ],
    examples: ["É um paradoxo fascinante: quanto mais aprendemos, mais percebemos o quanto ignoramos."],
    synonyms: ["contradição", "antinomia", "incongruência", "enigma"],
    source: "local"
  },
  "verossimilhança": {
    type: "word",
    grammaticalClass: "Substantivo feminino",
    etymology: "Junção de vero (verdadeiro) e semelhança",
    definitions: [
      "Qualidade do que parece verdadeiro ou plausível no contexto de uma narrativa artística ou literária.",
      "Coerência interna de uma obra que convence o leitor da probabilidade daquilo que está a ser narrado."
    ],
    examples: ["O autor construiu personagens com tal verossimilhança que pareciam pessoas reais."],
    synonyms: ["plausibilidade", "credibilidade", "coerência", "probabilidade"],
    source: "local"
  },
  "solilóquio": {
    type: "word",
    grammaticalClass: "Substantivo masculino",
    etymology: "Do latim solus (só) e loqui (falar)",
    definitions: [
      "Discurso ou fala que uma pessoa ou personagem dramática profere quando está sozinha ou como se estivesse a falar consigo mesma.",
      "Monólogo interior em que se expressam pensamentos íntimos em voz alta."
    ],
    examples: ["O célebre 'Ser ou não ser' de Hamlet é o solilóquio mais famoso do teatro ocidental."],
    synonyms: ["monólogo", "discurso interior", "meditação a sós"],
    source: "local"
  },
  "melancolia": {
    type: "word",
    grammaticalClass: "Substantivo feminino",
    etymology: "Do grego melas (negro) e chole (bílis)",
    definitions: [
      "Estado de tristeza profunda, serena e contemplativa, frequentemente acompanhada de saudade e introspeção.",
      "Tendência de ânimo meditativo e desolado que inspira poetas e artistas clássicos."
    ],
    examples: ["A melancolia suave das páginas finais conferiu à história um encanto poético inesquecível."],
    synonyms: ["tristeza", "nostalgia", "abatimento", "desalento", "introspeção"],
    source: "local"
  },
  "inefável": {
    type: "word",
    grammaticalClass: "Adjetivo de dois géneros",
    etymology: "Do latim ineffabilis, 'que não se pode exprimir'",
    definitions: [
      "Que não pode ser expresso por palavras; indescritível devido à sua magnitude, pureza ou sublime intensidade.",
      "Que provoca encantamento tal que ultrapassa o poder da linguagem humana."
    ],
    examples: ["Sentiu uma alegria inefável ao contemplar aquele nascer do sol nas montanhas."],
    synonyms: ["indescritível", "indizível", "inexprimível", "sublime", "divino"],
    source: "local"
  },
  "epifania": {
    type: "word",
    grammaticalClass: "Substantivo feminino",
    etymology: "Do grego epiphaneia, 'manifestação, aparição'",
    definitions: [
      "Momento súbito de revelação, iluminação espiritual ou compreensão intuitiva e profunda sobre a verdade de algo.",
      "Em literatura, instante em que um detalhe trivial revela ao protagonista o sentido oculto da sua existência."
    ],
    examples: ["Ao olhar para o espelho, a personagem teve uma epifania sobre o rumo que a sua vida tomara."],
    synonyms: ["revelação", "iluminação", "descoberta", "estalo", "insight"],
    source: "local"
  },
  "nostalgia": {
    type: "word",
    grammaticalClass: "Substantivo feminino",
    etymology: "Do grego nostos (regresso a casa) e algos (dor, sofrimento)",
    definitions: [
      "Saudade melancólica e terna de um tempo passado, de pessoas queridas ou de um lugar distante.",
      "Sentimento enternecido provocado pela lembrança de momentos felizes já vividos."
    ],
    examples: ["A música antiga despertou uma doce nostalgia da sua juventude."],
    synonyms: ["saudade", "lembrança", "melancolia", "recordação"],
    source: "local"
  },
  "perspicaz": {
    type: "word",
    grammaticalClass: "Adjetivo de dois géneros",
    etymology: "Do latim perspicax, 'que vê através de'",
    definitions: [
      "Dotado de inteligência aguda e penetrante; que percebe com rapidez o que escapa à maioria.",
      "Que possui discernimento apurado para analisar pessoas, situações e detalhes sutis."
    ],
    examples: ["O detetive fez uma observação perspicaz que desvendou o mistério da trama."],
    synonyms: ["sagaz", "astuto", "aguçado", "penetrante", "lúcido", "arguto"],
    source: "local"
  },
  "inexorável": {
    type: "word",
    grammaticalClass: "Adjetivo de dois géneros",
    etymology: "Do latim inexorabilis, 'que não se deixa dobrar por súplicas'",
    definitions: [
      "Que não se pode evitar, deter ou alterar; implacável, fatal, irrevogável.",
      "Pessoa severa, que não se deixa comover nem vergar por pedidos de clemência."
    ],
    examples: ["O tempo avança com o seu passo inexorável, indiferente aos anseios humanos."],
    synonyms: ["implacável", "inflexível", "inevitável", "fatal", "rigoroso"],
    source: "local"
  },
  "parcimónia": {
    type: "word",
    grammaticalClass: "Substantivo feminino",
    etymology: "Do latim parcimonia, 'economia, moderação'",
    definitions: [
      "Qualidade de quem é comedido nos gastos e no uso de recursos; moderação, sobriedade.",
      "Cuidado e contenção prudente na expressão de palavras ou na realização de atos."
    ],
    examples: ["O conselheiro geria os proventos do reino com notável parcimónia."],
    synonyms: ["sobriedade", "moderação", "economia", "comedimento", "cautela"],
    source: "local"
  },
  "arcabouço": {
    type: "word",
    grammaticalClass: "Substantivo masculino",
    etymology: "Do espanhol arcabuz ou do português arca",
    definitions: [
      "Estrutura esquelética ou armação principal que sustenta uma construção, corpo ou objeto.",
      "Em sentido figurado, conjunto estruturado de conceitos, leis ou princípios que formam uma teoria ou sistema."
    ],
    examples: ["O arcabouço teórico deste ensaio sustenta-se nas premissas da sociologia clássica."],
    synonyms: ["esqueleto", "armação", "estrutura", "fundamento", "alicerce"],
    source: "local"
  },
  "quimera": {
    type: "word",
    grammaticalClass: "Substantivo feminino",
    etymology: "Do grego chimaira, criatura mítica com cabeça de leão, corpo de cabra e cauda de serpente",
    definitions: [
      "Monstro da mitologia grega que cuspia fogo.",
      "Em sentido figurado, criação da imaginação sem base na realidade; fantasia irrealizável, sonho vão."
    ],
    examples: ["Perseguiu a quimera da riqueza fácil até perder tudo o que possuía."],
    synonyms: ["ilusão", "fantasia", "utopia", "ficção", "miragem"],
    source: "local"
  },
  "vicissitude": {
    type: "word",
    grammaticalClass: "Substantivo feminino",
    etymology: "Do latim vicissitudo, 'alternância, mudança'",
    definitions: [
      "Sucessão de mudanças e alternâncias ao longo da vida; acontecimentos fortuitos ou reveses.",
      "Inconstância ou mutabilidade da fortuna e dos destinos humanos."
    ],
    examples: ["Apesar das vicissitudes da existência, manteve a nobreza e a serenidade intactas."],
    synonyms: ["revés", "mudança", "alternância", "percalço", "instabilidade"],
    source: "local"
  },
  "taciturno": {
    type: "word",
    grammaticalClass: "Adjetivo",
    etymology: "Do latim taciturnus, derivado de tacere, 'calar-se'",
    definitions: [
      "Que fala pouco; silencioso, calado por temperamento ou costume.",
      "Que manifesta tristeza sombria, ar pensativo e reservado."
    ],
    examples: ["O velho marinheiro permanecia taciturno, observando o horizonte marítimo."],
    synonyms: ["calado", "silencioso", "reservado", "sombrio", "introspectivo"],
    source: "local"
  },
  "fidedigno": {
    type: "word",
    grammaticalClass: "Adjetivo",
    etymology: "Do latim fides (fé, confiança) e dignus (digno)",
    definitions: [
      "Que é digno de fé, crédito ou confiança; autêntico, verdadeiro, fidedigno.",
      "Relato ou testemunho que retrata a realidade sem distorções."
    ],
    examples: ["O cronista ofereceu um relato fidedigno dos acontecimentos históricos."],
    synonyms: ["confiável", "autêntico", "verdadeiro", "veraz", "crível"],
    source: "local"
  },
  "metáfora": {
    type: "word",
    grammaticalClass: "Substantivo feminino",
    etymology: "Do grego metaphora, 'transporte, transferência'",
    definitions: [
      "Figura de estilo que consiste na transferência do sentido de uma palavra para outro, por analogia implícita.",
      "Expressão poética que estabelece uma comparação direta sem o uso de conectivo comparativo explícito."
    ],
    examples: ["Dizer que 'a vida é um sopro' constitui uma metáfora sobre a fugacidade humana."],
    synonyms: ["figura de estilo", "translação", "alegoria", "analogia"],
    source: "local"
  },
  "saudade": {
    type: "word",
    grammaticalClass: "Substantivo feminino",
    etymology: "Do latim solitas, 'solidão', cruzado com soledade",
    definitions: [
      "Sentimento melancólico e afetuoso provocado pela ausência de pessoas, lugares, coisas ou tempos idos que foram prazerosos.",
      "Palavra de grande peso cultural na lusofonia, que expressa a presença viva de uma ausência."
    ],
    examples: ["A saudade da terra natal ecoava em cada verso do poeta exilado."],
    synonyms: ["nostalgia", "lembrança", "recordação", "melancolia"],
    source: "local"
  }
};

/**
 * Limpa e higieniza a expressão de busca
 */
export function sanitizeSearchText(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/^["'«»“„(«[\s.,;:!?-]+|["'«»””)»\]\s.,;:!?-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trata pronomes enclíticos frequentes na literatura em português
 * Exemplos:
 *  - "escrevê-lo" -> ["escrever", "escrevê"]
 *  - "amá-la" -> ["amar", "amá"]
 *  - "viu-se" -> ["viu", "ver"]
 *  - "disse-lhe" -> ["disse", "dizer"]
 */
export function stripEnclitics(word: string): string[] {
  const w = word.toLowerCase().trim();
  const set = new Set<string>([w]);

  const encliticMatch = w.match(/^(.*?)-(se|me|te|nos|vos|lhe|lhes|o|a|os|as|lo|la|los|las|no|na|nos|nas)$/i);
  if (encliticMatch) {
    const root = encliticMatch[1].trim();
    set.add(root);

    // Reconstitui o infinitivo regular
    if (/[áâ]$/i.test(root)) set.add(root.slice(0, -1) + "ar");
    if (/[éê]$/i.test(root)) set.add(root.slice(0, -1) + "er");
    if (/[í]$/i.test(root)) set.add(root.slice(0, -1) + "ir");
  }

  return Array.from(set);
}

/**
 * Gera lemas e formas canónicas para palavras flexionadas (plurais, femininos, advérbios, superlativos)
 */
export function generateCandidateLemmas(word: string): string[] {
  const clean = word.toLowerCase().trim();
  const set = new Set<string>([clean]);

  // Desanexa ênclise primeiro
  stripEnclitics(clean).forEach((e) => set.add(e));

  // 1. Plurais comuns
  if (clean.endsWith("ões")) set.add(clean.slice(0, -3) + "ão");
  if (clean.endsWith("ães")) set.add(clean.slice(0, -3) + "ão");
  if (clean.endsWith("ais")) set.add(clean.slice(0, -3) + "al");
  if (clean.endsWith("éis") || clean.endsWith("eis")) {
    set.add(clean.slice(0, -3) + "el");
    set.add(clean.slice(0, -3) + "il");
  }
  if (clean.endsWith("is")) set.add(clean.slice(0, -2) + "il");
  if (clean.endsWith("ns")) set.add(clean.slice(0, -2) + "m");
  if (clean.endsWith("res") || clean.endsWith("zes") || clean.endsWith("ses")) {
    set.add(clean.slice(0, -2));
  }
  if (clean.endsWith("s") && !clean.endsWith("ss") && clean.length > 3) {
    set.add(clean.slice(0, -1));
  }

  // 2. Feminino para masculino
  if (clean.endsWith("a") && clean.length > 3) set.add(clean.slice(0, -1) + "o");
  if (clean.endsWith("as") && clean.length > 4) set.add(clean.slice(0, -2) + "o");

  // 3. Superlativos (-íssimo, -íssima)
  if (clean.endsWith("íssima") || clean.endsWith("íssimo")) {
    const base = clean.slice(0, -6);
    set.add(base + "o");
    set.add(base + "a");
    set.add(base);
  }

  // 4. Diminutivos (-inho, -inha, -zinho, -zinha)
  if (clean.endsWith("inha") || clean.endsWith("inho")) {
    const base = clean.slice(0, -4);
    set.add(base + "o");
    set.add(base + "a");
  }
  if (clean.endsWith("zinha") || clean.endsWith("zinho")) {
    set.add(clean.slice(0, -5));
  }

  // 5. Advérbios em -mente
  if (clean.endsWith("mente") && clean.length > 6) {
    const base = clean.slice(0, -5);
    set.add(base);
    if (base.endsWith("a")) set.add(base.slice(0, -1) + "o");
  }

  return Array.from(set);
}

/**
 * Consulta e analisa o Wikcionário da Língua Portuguesa via API oficial
 */
async function fetchWiktionaryDefinition(word: string, depth = 0): Promise<DefinitionResult | null> {
  try {
    const url = `https://pt.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=text|sections&format=json&origin=*`;
    const res = await fetch(url, {
      headers: { "User-Agent": "KuwerengaApp/1.0 (contact@kuwerenga.app)" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.error || !data.parse?.text?.["*"]) return null;

    const html = data.parse.text["*"];
    const sections: Array<{ line: string; level: string }> = data.parse.sections || [];

    // Limpa scripts, estilos e comentários
    const cleanHtml = html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "");

    // Identifica classe gramatical através das secções oficiais
    const GRAMMATICAL_CLASSES = [
      "Substantivo",
      "Verbo",
      "Adjetivo",
      "Advérbio",
      "Pronome",
      "Conjunção",
      "Preposição",
      "Interjeição",
      "Locução",
      "Forma verbal",
      "Forma de substantivo",
      "Forma de adjetivo",
    ];

    let grammaticalClass: string | undefined;
    const matchedSection = sections.find((s) =>
      GRAMMATICAL_CLASSES.some((gc) => s.line.toLowerCase().includes(gc.toLowerCase()))
    );

    if (matchedSection) {
      grammaticalClass = matchedSection.line.replace(/<[^>]+>/g, "").trim();
    }

    // Extrai definições dos elementos <ol><li>
    const definitions: string[] = [];
    const examples: string[] = [];
    const olRegex = /<ol>([\s\S]*?)<\/ol>/gi;
    let olMatch: RegExpExecArray | null;

    while ((olMatch = olRegex.exec(cleanHtml)) !== null) {
      const liRegex = /<li>([\s\S]*?)<\/li>/gi;
      let liMatch: RegExpExecArray | null;

      while ((liMatch = liRegex.exec(olMatch[1])) !== null) {
        const rawLi = liMatch[1];

        // Extrai exemplos contidos em listas aninhadas
        const exMatch = rawLi.match(/<(?:dl|ul)[^>]*>[\s\S]*?<(?:dd|li)[^>]*>([\s\S]*?)<\/(?:dd|li)>/i);
        if (exMatch) {
          const cleanEx = exMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          if (cleanEx.length > 5 && !cleanEx.startsWith("(")) {
            examples.push(cleanEx);
          }
        }

        // Limpa sublistas antes de obter o texto principal da definição
        const cleanDef = rawLi
          .replace(/<(?:dl|ul|ol)[\s\S]*?<\/(?:dl|ul|ol)>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        if (
          cleanDef &&
          cleanDef.length > 2 &&
          !cleanDef.startsWith("Wikisource") &&
          !cleanDef.startsWith("Wikiquote")
        ) {
          definitions.push(cleanDef);
        }
      }
    }

    if (definitions.length === 0) return null;

    // Extrai sinónimos se disponíveis
    const synonyms: string[] = [];
    const synSection = cleanHtml.match(/<span class="mw-headline"[^>]*>Sin[ôo]nimos<\/span>[\s\S]*?<(?:ul|ol)>([\s\S]*?)<\/(?:ul|ol)>/i);
    if (synSection) {
      const synItems = synSection[1].match(/<li>([\s\S]*?)<\/li>/gi);
      if (synItems) {
        synItems.forEach((item: string) => {
          const syn = item.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          if (syn && syn.length < 40) synonyms.push(syn);
        });
      }
    }

    // ── Resolução de Forma Flexionada (ex: escreveram -> escrever) ──
    if (depth === 0 && definitions.length > 0) {
      const rootMatch = definitions[0].match(/(?:do verbo|verbo|plural de|feminino de)\s+([a-zçãõáéíóúâêîôû]+)/i);
      if (rootMatch && rootMatch[1] && rootMatch[1].toLowerCase() !== word.toLowerCase()) {
        const rootWord = rootMatch[1].toLowerCase();
        const rootResult = await fetchWiktionaryDefinition(rootWord, 1);

        if (rootResult && rootResult.definitions.length > 0) {
          return {
            term: data.parse.title || word,
            type: "word",
            baseForm: rootWord,
            grammaticalClass: grammaticalClass || (rootMatch[0].includes("verbo") ? "Forma verbal" : "Forma flexionada"),
            inflectionNote: definitions[0],
            definitions: rootResult.definitions,
            examples: rootResult.examples && rootResult.examples.length > 0 ? rootResult.examples : examples,
            synonyms: rootResult.synonyms && rootResult.synonyms.length > 0 ? rootResult.synonyms : synonyms,
            source: "wiktionary",
          };
        }
      }
    }

    return {
      term: data.parse.title || word,
      type: "word",
      grammaticalClass,
      definitions: Array.from(new Set(definitions)),
      examples: Array.from(new Set(examples)).slice(0, 3),
      synonyms: Array.from(new Set(synonyms)).slice(0, 6),
      source: "wiktionary",
    };
  } catch (err) {
    console.warn("Aviso na consulta ao Wikcionário:", err);
    return null;
  }
}

/**
 * Consulta o Dicionário Aberto da Língua Portuguesa (Fonte de Apoio)
 */
async function fetchDicionarioAberto(word: string): Promise<DefinitionResult | null> {
  try {
    const wordParam = encodeURIComponent(word.toLowerCase());
    const response = await fetch(`https://api.dicionario-aberto.net/word/${wordParam}`);
    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0 || !data[0].xml) return null;

    const parser = new DOMParser();
    const doc = parser.parseFromString(data[0].xml, "text/xml");

    const gramNode = doc.querySelector("gramGrp");
    const grammaticalClass = gramNode?.textContent?.trim() || undefined;

    const etymNode = doc.querySelector("etym");
    const etymology = etymNode?.textContent?.trim() || undefined;

    const defNodes = doc.querySelectorAll("def");
    const definitions: string[] = [];

    defNodes.forEach((node) => {
      const text = node.textContent || "";
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("_"));
      definitions.push(...lines);
    });

    if (definitions.length === 0) return null;

    return {
      term: word,
      type: "word",
      grammaticalClass,
      etymology,
      definitions,
      source: "dicionario",
    };
  } catch {
    return null;
  }
}

/**
 * Consulta a Wikipédia em Português para Entidades, Conceitos e Expressões
 */
async function fetchWikipediaSummary(query: string): Promise<DefinitionResult | null> {
  try {
    const summaryParam = encodeURIComponent(query);
    const wikiResp = await fetch(`https://pt.wikipedia.org/api/rest_v1/page/summary/${summaryParam}`);
    if (!wikiResp.ok) return null;

    const wikiData = await wikiResp.json();
    if (!wikiData.extract) return null;

    return {
      term: wikiData.title || query,
      type: query.includes(" ") ? "phrase" : "word",
      definitions: [wikiData.extract],
      summary: wikiData.description || undefined,
      source: "wikipedia",
    };
  } catch {
    return null;
  }
}

/**
 * Explicador Semântico com IA (Gemini) se a chave estiver configurada
 */
async function fetchGeminiExplanation(text: string): Promise<DefinitionResult | null> {
  const geminiApiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!geminiApiKey) return null;

  try {
    const prompt = `És um lexicógrafo e linguista da língua portuguesa. Fornece uma explicação precisa para a seguinte palavra ou expressão no contexto de um leitor de livros.
Texto: "${text}"

Responde APENAS em formato JSON válido (sem tags markdown nem explicações adicionais) com a seguinte estrutura:
{
  "term": "${text}",
  "type": "${text.includes(" ") ? "phrase" : "word"}",
  "grammaticalClass": "classe gramatical (ex: Substantivo, Verbo, Expressão idiomática)",
  "definitions": ["Definição 1 clara e direta", "Definição 2 ou sentido figurado"],
  "examples": ["Exemplo de uso em frase real"],
  "synonyms": ["sinónimo 1", "sinónimo 2"]
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) {
        const parsed = JSON.parse(content);
        return {
          term: parsed.term || text,
          type: parsed.type || (text.includes(" ") ? "phrase" : "word"),
          grammaticalClass: parsed.grammaticalClass || undefined,
          definitions: Array.isArray(parsed.definitions) ? parsed.definitions : [parsed.definitions],
          examples: Array.isArray(parsed.examples) ? parsed.examples : [],
          synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms : [],
          source: "gemini",
        };
      }
    }
  } catch (err) {
    console.warn("Falha no explicador IA:", err);
  }

  return null;
}

/**
 * Ponto de entrada unificado para consulta de definições
 * Executa cascata inteligente e garante precisão cirúrgica
 */
export async function getTermDefinition(rawText: string): Promise<DefinitionResult> {
  const cleaned = sanitizeSearchText(rawText);
  if (!cleaned) {
    throw new Error("Nenhum termo ou texto selecionado.");
  }

  const cacheKey = DICT_CACHE_PREFIX + cleaned.toLowerCase();

  // 1. Verificar Cache Local (LocalStorage)
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return { ...parsed, source: "local" };
    }
  } catch {}

  const lower = cleaned.toLowerCase();

  // 2. Léxico Curado Embutido (Offline Instantâneo)
  if (LOCAL_CURATED_LEXICON[lower]) {
    const res: DefinitionResult = {
      term: cleaned,
      ...LOCAL_CURATED_LEXICON[lower],
    };
    try {
      localStorage.setItem(cacheKey, JSON.stringify(res));
    } catch {}
    return res;
  }

  // Gera lemas candidatos morfológicos
  const candidates = generateCandidateLemmas(cleaned);

  // Verifica se algum lema candidato existe no léxico curado
  for (const cand of candidates) {
    if (LOCAL_CURATED_LEXICON[cand]) {
      const res: DefinitionResult = {
        term: cleaned,
        baseForm: cand !== lower ? cand : undefined,
        ...LOCAL_CURATED_LEXICON[cand],
      };
      try {
        localStorage.setItem(cacheKey, JSON.stringify(res));
      } catch {}
      return res;
    }
  }

  // 3. Consulta ao Wikcionário Lusófono (Para a palavra exata ou lemas)
  for (const cand of candidates) {
    const wikResult = await fetchWiktionaryDefinition(cand);
    if (wikResult && wikResult.definitions.length > 0) {
      const finalResult: DefinitionResult = {
        ...wikResult,
        term: cleaned,
        baseForm: wikResult.baseForm || (cand !== lower ? cand : undefined),
      };

      try {
        localStorage.setItem(cacheKey, JSON.stringify(finalResult));
      } catch {}
      return finalResult;
    }
  }

  // 4. Dicionário Aberto da Língua Portuguesa
  for (const cand of candidates) {
    const daResult = await fetchDicionarioAberto(cand);
    if (daResult && daResult.definitions.length > 0) {
      const finalResult: DefinitionResult = {
        ...daResult,
        term: cleaned,
        baseForm: cand !== lower ? cand : undefined,
      };

      try {
        localStorage.setItem(cacheKey, JSON.stringify(finalResult));
      } catch {}
      return finalResult;
    }
  }

  // 5. Wikipédia Lusófona (Para entidades, conceitos e expressões)
  const wikiResult = await fetchWikipediaSummary(cleaned);
  if (wikiResult && wikiResult.definitions.length > 0) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(wikiResult));
    } catch {}
    return wikiResult;
  }

  // 6. IA Contextual (Se chave Gemini estiver disponível)
  const geminiResult = await fetchGeminiExplanation(cleaned);
  if (geminiResult && geminiResult.definitions.length > 0) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(geminiResult));
    } catch {}
    return geminiResult;
  }

  // 7. Se for uma expressão de várias palavras sem verbete direto
  if (cleaned.includes(" ")) {
    const words = cleaned.split(/\s+/).filter(Boolean);
    return {
      term: cleaned,
      type: "phrase",
      definitions: [
        `Expressão composta por ${words.length} palavras: "${cleaned}".`,
        "Dica: podes tocar ou selecionar palavras individuais no texto para consultar a definição exata de cada termo no dicionário.",
      ],
      summary: "Expressão selecionada",
      source: "local",
    };
  }

  throw new Error(`Não foi possível encontrar a definição de "${cleaned}". Tenta pesquisar pelo infinitivo do verbo ou pela forma singular.`);
}
