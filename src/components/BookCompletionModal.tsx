import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Trophy,
  CheckCircle2,
  BookOpen,
  Clock,
  Sparkles,
  Library,
  RotateCcw
} from "lucide-react";

interface BookCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmFinish: () => Promise<void>;
  bookTitle: string;
  totalPages: number;
  sessionMinutes: number;
  currentPage: number;
}

export default function BookCompletionModal({
  isOpen,
  onClose,
  onConfirmFinish,
  bookTitle,
  totalPages,
  sessionMinutes,
  currentPage
}: BookCompletionModalProps) {
  const [isFinishing, setIsFinishing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      await onConfirmFinish();
      setIsCompleted(true);
    } catch (err) {
      console.error("Erro ao concluir livro:", err);
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl p-6 sm:p-7 flex flex-col text-black dark:text-white animate-in zoom-in-95 duration-200 relative overflow-hidden"
      >
        {/* Botão de Fecho */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Fechar"
          aria-label="Fechar"
        >
          <X className="w-4 h-4 stroke-[2]" />
        </button>

        {!isCompleted ? (
          <>
            {/* Ícone de Destaque */}
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 shadow-xs">
              <Trophy className="w-7 h-7 stroke-[1.8]" />
            </div>

            {/* Cabeçalho */}
            <h2 className="text-lg sm:text-xl font-bold tracking-tight mb-1">
              Chegaste à última página!
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-5 leading-relaxed">
              Terminaste realmente a leitura de{" "}
              <span className="font-semibold text-black dark:text-white">
                «{bookTitle}»
              </span>
              ?
            </p>

            {/* Cartão de Resumo da Sessão */}
            <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800 mb-6 text-center">
              <div className="flex flex-col items-center">
                <BookOpen className="w-4 h-4 text-gray-400 mb-1" />
                <span className="text-xs sm:text-sm font-bold">
                  {totalPages > 0 ? totalPages : currentPage}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  Páginas
                </span>
              </div>

              <div className="flex flex-col items-center border-x border-gray-200 dark:border-gray-700">
                <Clock className="w-4 h-4 text-gray-400 mb-1" />
                <span className="text-xs sm:text-sm font-bold">
                  {sessionMinutes > 0 ? `${sessionMinutes}m` : "< 1m"}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  Nesta sessão
                </span>
              </div>

              <div className="flex flex-col items-center">
                <Sparkles className="w-4 h-4 text-emerald-500 mb-1" />
                <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  100%
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  Progresso
                </span>
              </div>
            </div>

            {/* Ações */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleFinish}
                disabled={isFinishing}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-black dark:bg-white text-white dark:text-black hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                {isFinishing ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
                    <span>Sim, marcar como lido</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="py-3 px-4 rounded-xl font-medium text-xs text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-98 transition-all flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ainda não / Continuar a ler</span>
              </button>
            </div>
          </>
        ) : (
          <div className="py-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
            </div>

            <h3 className="text-lg font-bold mb-1">Parabéns pela leitura!</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-6 leading-relaxed">
              O livro foi marcado como concluído e adicionado à tua estante de livros lidos.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => navigate("/library")}
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs bg-black dark:bg-white text-white dark:text-black hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <Library className="w-4 h-4" />
                <span>Ir para a Biblioteca</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl font-medium text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Permanecer no leitor
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
