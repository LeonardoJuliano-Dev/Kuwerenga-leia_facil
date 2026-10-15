import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  MessageCircle,
  BookOpen,
  Sparkles,
  X,
  ExternalLink
} from "lucide-react";
import {
  subscribeToInAppToast,
  markNotificationAsRead,
  type AppNotification
} from "../lib/notificationService";

export default function InAppNotificationToast() {
  const [currentNotif, setCurrentNotif] = useState<AppNotification | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = subscribeToInAppToast((notif) => {
      // Limpa temporizador anterior se já existir um ativo
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setCurrentNotif(notif);
      setIsVisible(true);

      // Auto-fecho após 5 segundos
      timerRef.current = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => setCurrentNotif(null), 300);
      }, 5000);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!currentNotif) return null;

  const handleDismiss = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(() => setCurrentNotif(null), 300);
  };

  const handleClick = () => {
    if (currentNotif) {
      markNotificationAsRead(currentNotif.id);
      if (currentNotif.link) {
        navigate(currentNotif.link);
      }
    }
    handleDismiss();
  };

  const getIcon = () => {
    switch (currentNotif.type) {
      case "community_message":
        return <MessageCircle className="w-5 h-5 text-sky-500" />;
      case "book_idle":
        return <BookOpen className="w-5 h-5 text-amber-500" />;
      case "reading_reminder":
        return <Sparkles className="w-5 h-5 text-emerald-500" />;
      case "admin_approval":
        return <Sparkles className="w-5 h-5 text-amber-500" />;
      default:
        return <Bell className="w-5 h-5 text-purple-500" />;
    }
  };

  return (
    <div
      className={`fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-md transition-all duration-300 ease-out pointer-events-auto ${
        isVisible
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 -translate-y-6 scale-95 pointer-events-none"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div
        onClick={handleClick}
        className="group relative flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/90 dark:border-gray-800/90 shadow-[0_12px_40px_rgb(0_0_0_/_16%)] dark:shadow-[0_12px_40px_rgb(0_0_0_/_50%)] cursor-pointer hover:border-black/20 dark:hover:border-white/20 transition-all select-none"
      >
        {/* Ícone com cápsula temática de alto contraste */}
        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700/70 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
          {getIcon()}
        </div>

        {/* Informações da Notificação */}
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Notificação
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <h4 className="text-xs font-bold text-black dark:text-white truncate">
            {currentNotif.title}
          </h4>

          <p className="text-[11px] text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed mt-0.5">
            {currentNotif.message}
          </p>

          {currentNotif.link && (
            <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-black dark:text-white group-hover:underline">
              <span>Ver detalhes</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </div>
          )}
        </div>

        {/* Botão de Fechar */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-lg text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Fechar notificação"
          aria-label="Fechar"
        >
          <X className="w-4 h-4 stroke-[2]" />
        </button>
      </div>
    </div>
  );
}
