/**
 * Serviço de Dicionário e Definições de Termos e Frases (Português)
 * Suporta consulta de termos únicos e expressões/frases com cache offline
 */

export interface DefinitionResult {
  term: string;
  type: "word" | "phrase";
  grammaticalClass?: string;
  etymology?: string;
  definitions: string[];
  source: "dicionario" | "wikipedia" | "local" | "contextual";
  summary?: string;
  details?: string;
}

const DICT_CACHE_PREFIX = "kuwerenga_dict_";

/**
 * Limpa pontuações estranhas ao redor do texto
 */
export function sanitizeSearchText(raw: string): string {
  return raw
    .trim()
    .replace(/^["'«»“„(«[\s.,;:!?-]+|["'«»””)»\]\s.,;:!?-]+$/g, "")
    .trim();
}

/**
 * Faz o parse do XML devolvido pelo Dicionário Aberto
 */
function parseDicionarioAbertoXml(xmlText: string): { grammaticalClass?: string; etymology?: string; definitions: string[] } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");

    // Classe gramatical (ex: f., m., v. t.)
    const gramNode = doc.querySelector("gramGrp");
    const grammaticalClass = gramNode?.textContent?.trim() || undefined;

    // Etimologia (origem da palavra)
    const etymNode = doc.querySelector("etym");
    const etymology = etymNode?.textContent?.trim() || undefined;

    // Definições
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

    return { grammaticalClass, etymology, definitions };
  } catch (err) {
    console.warn("Erro ao fazer parse do XML do dicionário:", err);
    return { definitions: [] };
  }
}

/**
 * Consulta a definição de uma palavra ou frase
 */
export async function getTermDefinition(rawText: string): Promise<DefinitionResult> {
  const cleaned = sanitizeSearchText(rawText);
  if (!cleaned) {
    throw new Error("Nenhum termo ou texto selecionado.");
  }

  const cacheKey = DICT_CACHE_PREFIX + cleaned.toLowerCase();

  // 1. Verificar Cache Local (IndexedDB / LocalStorage)
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return { ...parsed, source: "local" };
    }
  } catch {}

  const words = cleaned.split(/\s+/).filter(Boolean);
  const isSingleWord = words.length === 1;

  // 2. Se for uma única palavra, tentar o Dicionário Aberto da Língua Portuguesa
  if (isSingleWord) {
    const wordParam = encodeURIComponent(cleaned.toLowerCase());
    try {
      const response = await fetch(`https://api.dicionario-aberto.net/word/${wordParam}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0 && data[0].xml) {
          const { grammaticalClass, etymology, definitions } = parseDicionarioAbertoXml(data[0].xml);

          if (definitions.length > 0) {
            const result: DefinitionResult = {
              term: cleaned,
              type: "word",
              grammaticalClass,
              etymology,
              definitions,
              source: "dicionario",
            };

            // Guarda em cache local para futuras consultas offline
            try {
              localStorage.setItem(cacheKey, JSON.stringify(result));
            } catch {}

            return result;
          }
        }
      }
    } catch (e) {
      console.warn("Falha ao consultar Dicionário Aberto, a tentar Wikipédia:", e);
    }
  }

  // 3. Consulta Enciclopédica (Wikipédia em Português) para termos ou expressões
  try {
    const summaryParam = encodeURIComponent(cleaned);
    const wikiResp = await fetch(`https://pt.wikipedia.org/api/rest_v1/page/summary/${summaryParam}`);

    if (wikiResp.ok) {
      const wikiData = await wikiResp.json();
      if (wikiData.extract) {
        const result: DefinitionResult = {
          term: wikiData.title || cleaned,
          type: isSingleWord ? "word" : "phrase",
          definitions: [wikiData.extract],
          summary: wikiData.description || undefined,
          source: "wikipedia",
        };

        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch {}

        return result;
      }
    }
  } catch (wikiErr) {
    console.warn("Falha na consulta enciclopédica:", wikiErr);
  }

  // 4. Se for frase ou expressão sem página enciclopédica direta, fornecer análise contextual
  if (!isSingleWord) {
    const result: DefinitionResult = {
      term: cleaned,
      type: "phrase",
      definitions: [
        `Expressão composta por ${words.length} palavras: "${cleaned}".`,
        "Podes selecionar palavras individuais para consultar o significado exato no dicionário da língua portuguesa."
      ],
      summary: "Expressão / Trecho selecionado",
      source: "contextual"
    };

    return result;
  }

  // Se não foi encontrada no dicionário nem na enciclopédia
  throw new Error(`Não foi encontrada uma definição para "${cleaned}". Verifica se a palavra está escrita corretamente.`);
}
