import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Library,
  Sparkles,
  Highlighter,
  BookA,
  BookmarkCheck,
  Users,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  FileText,
  CheckCircle2,
  Heart
} from "lucide-react";

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (step === 3) {
      navigate("/login");
    } else {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSkip = () => {
    navigate("/login");
  };

  return (
    <div className="flex flex-col min-h-screen p-5 sm:p-8 bg-white dark:bg-black text-black dark:text-white justify-between select-none">
      
      {/* Top Header com Botão Voltar e Saltar */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between h-10">
        {step > 0 ? (
          <button
            onClick={handlePrev}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
            title="Voltar ao anterior"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        ) : (
          <div />
        )}

        {step < 3 ? (
          <button
            onClick={handleSkip}
            className="text-xs font-semibold text-gray-400 hover:text-black dark:hover:text-white px-3 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
          >
            Saltar
          </button>
        ) : (
          <div />
        )}
      </header>

      {/* Conteúdo Dinâmico Centralizado */}
      <main className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto w-full py-4">
        
        {/* SLIDE 0: BOAS-VINDAS */}
        {step === 0 && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-400 w-full">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-3xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xl p-4">
                <img src="/favicon.svg" alt="KUWERENGA+" className="w-16 h-16 object-contain" />
              </div>
              <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold mb-1 tracking-tight">
              KUWERENGA<span className="text-emerald-500">+</span>
            </h1>
            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-bold mb-3">
              Leia Fácil
            </p>
            <p className="text-gray-600 dark:text-gray-300 text-sm max-w-xs leading-relaxed mb-8">
              Mais do que livros, é o teu universo pessoal e comunitário de leitura.
            </p>

            {/* Badges de recursos chave */}
            <div className="grid grid-cols-2 gap-2.5 w-full max-w-xs">
              <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-gray-50 dark:bg-gray-900/80 border border-gray-100 dark:border-gray-800 text-left">
                <div className="w-7 h-7 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight">PDF & EPUB</div>
                  <div className="text-[10px] text-gray-400">Multi-formato</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-gray-50 dark:bg-gray-900/80 border border-gray-100 dark:border-gray-800 text-left">
                <div className="w-7 h-7 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight">100% Offline</div>
                  <div className="text-[10px] text-gray-400">Lê sem internet</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-gray-50 dark:bg-gray-900/80 border border-gray-100 dark:border-gray-800 text-left">
                <div className="w-7 h-7 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                  <BookA className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight">Dicionário</div>
                  <div className="text-[10px] text-gray-400">Léxico português</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-gray-50 dark:bg-gray-900/80 border border-gray-100 dark:border-gray-800 text-left">
                <div className="w-7 h-7 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight">Clubes & Notas</div>
                  <div className="text-[10px] text-gray-400">Em comunidade</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 1: BIBLIOTECA & FORMATOS */}
        {step === 1 && (
          <div className="flex flex-col items-center animate-in slide-in-from-right-8 duration-350 w-full">
            {/* Mockup visual de estante/livros */}
            <div className="w-full max-w-xs h-56 mb-6 flex items-center justify-center relative">
              {/* Livro 2 (fundo) */}
              <div className="w-36 h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl absolute -left-1 sm:left-2 rotate-[-6deg] shadow-lg p-3 flex flex-col justify-between opacity-80">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10">PDF</span>
                  <FileText className="w-3.5 h-3.5 opacity-50" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold truncate">O Alquimista</div>
                  <div className="text-[10px] text-gray-500 truncate">Paulo Coelho</div>
                </div>
              </div>

              {/* Livro 1 (frente) */}
              <div className="w-40 h-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl absolute right-2 sm:right-6 rotate-[3deg] shadow-2xl p-4 flex flex-col justify-between z-10">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                      EPUB
                    </span>
                    <BookmarkCheck className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center mb-2">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="text-left font-bold text-sm leading-tight">
                    Dom Casmurro
                  </div>
                  <div className="text-left text-[11px] text-gray-400 mt-0.5">
                    Machado de Assis
                  </div>
                </div>

                {/* Progresso do Livro */}
                <div>
                  <div className="flex justify-between text-[10px] text-gray-400 font-semibold mb-1">
                    <span>A ler</span>
                    <span>68%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="w-[68%] h-full bg-emerald-500 rounded-full" />
                  </div>
                </div>
              </div>

              {/* Selo flutuante de Biblioteca */}
              <div className="absolute -bottom-2 left-6 z-20 px-3 py-1.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-[11px] font-bold shadow-xl flex items-center gap-1.5">
                <Library className="w-3.5 h-3.5" />
                <span>Biblioteca Ilimitada</span>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3 tracking-tight">
              Todos os teus livros.<br />Num só lugar.
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs leading-relaxed">
              Importa e organiza os teus ficheiros PDF e EPUB. Guarda livros offline para ler em qualquer lugar, mesmo sem internet.
            </p>
          </div>
        )}

        {/* SLIDE 2: AMBIENTE DE LEITURA & FERRAMENTAS */}
        {step === 2 && (
          <div className="flex flex-col items-center animate-in slide-in-from-right-8 duration-350 w-full">
            {/* Mockup visual do ambiente de leitura com Dicionário e Realces */}
            <div className="w-full max-w-xs h-56 mb-6 flex items-center justify-center relative">
              <div className="w-full h-52 bg-[#fbf0d9] text-[#433422] rounded-3xl p-4 shadow-xl border border-[#dfceaa] flex flex-col justify-between text-left relative overflow-hidden">
                {/* Cabeçalho do Leitor */}
                <div className="flex items-center justify-between text-[10px] font-bold text-[#7a6449] border-b border-[#ebd7b1] pb-2">
                  <span>Capítulo III • O Segredo</span>
                  <span>Sépia Confortável</span>
                </div>

                {/* Texto com realce */}
                <div className="text-xs leading-relaxed my-auto">
                  <p className="text-gray-800">
                    "O essencial é invisível aos olhos...{" "}
                    <span className="bg-yellow-300/80 px-1 py-0.5 rounded font-semibold text-black">
                      só se vê bem com o coração
                    </span>
                    ."
                  </p>
                </div>

                {/* Menu de ferramentas flutuante simulado */}
                <div className="bg-white/95 text-black rounded-2xl p-1.5 shadow-lg border border-gray-200 flex items-center justify-between text-[10px] font-bold">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-black text-white">
                    <BookA className="w-3 h-3" />
                    <span>Definir</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-xl text-gray-700">
                    <Highlighter className="w-3 h-3 text-yellow-500" />
                    <span>Pintar</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-xl text-gray-700">
                    <BookmarkCheck className="w-3 h-3 text-emerald-500" />
                    <span>Nota</span>
                  </div>
                </div>
              </div>

              {/* Pílula flutuante da barra inferior */}
              <div className="absolute -bottom-2 right-4 z-20 px-3 py-1 rounded-full bg-[#433422] text-[#fbf0d9] text-[10px] font-bold shadow-lg flex items-center gap-2">
                <span>◀</span>
                <span>Pág. 42 de 120</span>
                <span>▶</span>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3 tracking-tight">
              Lê com conforto.<br />Anota e define.
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs leading-relaxed">
              Consulta significados no dicionário de português com um toque, realça passagens com 4 cores suaves e desfruta do tema sépia descansado.
            </p>
          </div>
        )}

        {/* SLIDE 3: COMUNIDADE & CLUBES */}
        {step === 3 && (
          <div className="flex flex-col items-center animate-in slide-in-from-right-8 duration-350 w-full">
            {/* Mockup visual de comunidade e debate literário */}
            <div className="w-full max-w-xs h-56 mb-6 flex items-center justify-center relative">
              <div className="w-full h-52 bg-white dark:bg-gray-900 rounded-3xl p-4 shadow-xl border border-gray-100 dark:border-gray-800 flex flex-col justify-between text-left">
                {/* Cabeçalho do Clube */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">Clube dos Clássicos</div>
                      <div className="text-[10px] text-gray-400">28 membros a ler</div>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-red-50 dark:bg-red-950/40 text-red-500 flex items-center justify-center">
                    <Heart className="w-3.5 h-3.5 fill-current" />
                  </div>
                </div>

                {/* Balão de mensagem / debate */}
                <div className="bg-gray-50 dark:bg-gray-800/80 rounded-2xl p-3 border border-gray-100 dark:border-gray-700 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[11px] text-gray-700 dark:text-gray-200">Leonardo</span>
                    <span className="text-[10px] text-gray-400">há 5 min</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 text-[11px] leading-relaxed">
                    "Que reviravolta neste capítulo! Alguém reparou na pista na página 42? 📖✨"
                  </p>
                </div>

                {/* Botão de interação */}
                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-semibold">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> 14 comentários
                  </span>
                  <span>•</span>
                  <span>Comunidade Ativa</span>
                </div>
              </div>

              {/* Selo flutuante de comunidade */}
              <div className="absolute -bottom-2 left-6 z-20 px-3 py-1.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-[11px] font-bold shadow-xl flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>Leitura Partilhada</span>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3 tracking-tight">
              Lê sozinho ou<br />em comunidade.
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs leading-relaxed">
              Participa em clubes de leitura, partilha reflexões sobre os teus livros favoritos e descobre novas obras recomendadas.
            </p>
          </div>
        )}
      </main>

      {/* Controlos Inferiores (Pílulas de Passo e Botão de Ação) */}
      <footer className="w-full max-w-sm mx-auto flex flex-col items-center pb-4 sm:pb-6">
        {/* Indicadores de Passo clicáveis */}
        {step > 0 && (
          <div className="flex items-center gap-2 mb-6">
            {[1, 2, 3].map((i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  step === i
                    ? "w-7 bg-black dark:bg-white"
                    : "w-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700"
                }`}
                title={`Ir para o passo ${i}`}
              />
            ))}
          </div>
        )}

        {/* Botão de Avançar */}
        <button
          onClick={handleNext}
          className="w-full bg-black dark:bg-white text-white dark:text-black font-bold py-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl hover:opacity-90"
        >
          <span>
            {step === 0
              ? "Conhecer a Aplicação"
              : step === 3
              ? "Começar a Ler"
              : "Continuar"}
          </span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </footer>
    </div>
  );
}
