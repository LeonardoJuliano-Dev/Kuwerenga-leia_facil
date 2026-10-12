import { useNavigate } from "react-router-dom";
import { Lock, Check, X, ArrowRight } from "lucide-react";

interface GuestRestrictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  feature?: "notes" | "highlights" | "bookmarks" | "community" | "donate" | "general";
}

export default function GuestRestrictionModal({
  isOpen,
  onClose,
  title,
  description,
  feature = "general"
}: GuestRestrictionModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  // Textos contextuais adaptados ao recurso tentado pelo utilizador
  const getContextualContent = () => {
    switch (feature) {
      case "notes":
        return {
          defaultTitle: "Anotações Exclusivas para Membros",
          defaultDesc: "Escrever e guardar notas requer uma conta gratuita para que as tuas reflexões fiquem salvas com segurança na tua biblioteca.",
          benefit: "Guardar notas sincronizadas entre dispositivos"
        };
      case "highlights":
        return {
          defaultTitle: "Realces e Cores Exclusivos",
          defaultDesc: "Pintar e destacar trechos de livros requer uma conta gratuita para manter os teus marcadores guardados sempre que abres o livro.",
          benefit: "Manter citações e trechos realçados para sempre"
        };
      case "bookmarks":
        return {
          defaultTitle: "Marcadores de Página",
          defaultDesc: "Os marcadores de página ficam vinculados à tua conta pessoal para que possas retomar de onde paraste em qualquer aparelho.",
          benefit: "Histórico e marcadores de leitura na nuvem"
        };
      case "community":
        return {
          defaultTitle: "Junta-te à Comunidade Kuwerenga+",
          defaultDesc: "Participar em clubes de leitura, entrar em debates e partilhar opiniões requer uma conta para identificar os membros da comunidade.",
          benefit: "Participar em clubes e criar debates literários"
        };
      case "donate":
        return {
          defaultTitle: "Doação e Partilha de Livros",
          defaultDesc: "O envio de livros para a biblioteca pública requer uma conta para garantir a autenticidade e a atribuição dos livros.",
          benefit: "Partilhar obras e enriquecer a biblioteca moçambicana"
        };
      default:
        return {
          defaultTitle: "Funcionalidade Exclusiva para Membros",
          defaultDesc: "Estás a utilizar o Kuwerenga+ em Modo Convidado. Cria uma conta gratuita em segundos para desbloquear todos os recursos.",
          benefit: "Acesso completo a notas, comunidade e sincronização"
        };
    }
  };

  const content = getContextualContent();
  const finalTitle = title || content.defaultTitle;
  const finalDesc = description || content.defaultDesc;

  const handleGoToLogin = () => {
    onClose();
    navigate("/login");
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-sm sm:max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-black dark:text-white relative overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Botão Fechar no Topo */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Ícone e Cabeçalho */}
        <div className="flex flex-col items-center text-center pt-2 pb-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 shadow-sm">
            <Lock className="w-7 h-7 stroke-[2]" />
          </div>

          <h3 className="text-lg sm:text-xl font-bold tracking-tight mb-2">
            {finalTitle}
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs">
            {finalDesc}
          </p>
        </div>

        {/* Vantagens de criar conta */}
        <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-4 my-2 border border-gray-100 dark:border-gray-800 space-y-2.5 text-xs">
          <div className="flex items-center gap-2.5 text-gray-700 dark:text-gray-300">
            <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </div>
            <span>{content.benefit}</span>
          </div>
          <div className="flex items-center gap-2.5 text-gray-700 dark:text-gray-300">
            <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </div>
            <span>Acesso completo à comunidade e clubes</span>
          </div>
          <div className="flex items-center gap-2.5 text-gray-700 dark:text-gray-300">
            <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </div>
            <span>100% gratuito e rápido de criar</span>
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-col gap-2.5 pt-4">
          <button
            onClick={handleGoToLogin}
            className="w-full bg-black dark:bg-white text-white dark:text-black font-bold py-3 px-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm shadow-md"
          >
            <span>Iniciar Sessão / Criar Conta</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
          
          <button
            onClick={onClose}
            className="w-full text-xs text-gray-500 hover:text-black dark:hover:text-white py-2 font-semibold transition-colors"
          >
            Continuar a Ler em Modo Convidado
          </button>
        </div>
      </div>
    </div>
  );
}
