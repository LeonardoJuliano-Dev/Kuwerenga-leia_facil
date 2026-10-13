import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  X,
  MessageCircle,
  BookOpen,
  Sparkles,
  Settings,
  ChevronRight,
  ExternalLink,
  VolumeX,
  Volume2
} from "lucide-react";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  subscribeToNotifications,
  getNotificationSettings,
  saveNotificationSettings,
  toggleMuteClub,
  requestBrowserNotificationPermission,
  type AppNotification,
  type NotificationSettings
} from "../lib/notificationService";

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationsModal({ isOpen, onClose }: NotificationsModalProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>(getNotifications);
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings);
  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "community" | "reading">("all");
  const [showQuickSettings, setShowQuickSettings] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Subscreve a atualizações em tempo real das notificações
    const unsubscribe = subscribeToNotifications((list) => {
      setNotifications(list);
    });

    setSettings(getNotificationSettings());

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleMuteAll = () => {
    const updated = saveNotificationSettings({ muteAll: !settings.muteAll });
    setSettings(updated);
  };

  const handleToggleSetting = (key: keyof NotificationSettings) => {
    const currentVal = settings[key];
    if (typeof currentVal === "boolean") {
      const updated = saveNotificationSettings({ [key]: !currentVal });
      setSettings(updated);
    }
  };

  const handleToggleMuteClub = (e: React.MouseEvent, clubId: string) => {
    e.stopPropagation();
    toggleMuteClub(clubId);
    setSettings(getNotificationSettings());
  };

  const handleRequestBrowserPerm = async () => {
    await requestBrowserNotificationPermission();
    setSettings(getNotificationSettings());
  };

  const handleNotificationClick = (item: AppNotification) => {
    markNotificationAsRead(item.id);
    onClose();
    if (item.link) {
      navigate(item.link);
    }
  };

  // Filtragem da lista
  const filteredNotifications = notifications.filter((item) => {
    if (activeFilter === "unread") return !item.read;
    if (activeFilter === "community") return item.type === "community_message";
    if (activeFilter === "reading") return item.type === "book_idle" || item.type === "reading_reminder";
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatRelativeTime = (timestamp: string) => {
    try {
      const diffMs = Date.now() - new Date(timestamp).getTime();
      const diffMinutes = Math.floor(diffMs / (60 * 1000));
      if (diffMinutes < 1) return "Agora mesmo";
      if (diffMinutes < 60) return `Há ${diffMinutes} min`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `Há ${diffHours} h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return "Ontem";
      if (diffDays < 7) return `Há ${diffDays} dias`;
      return new Date(timestamp).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
    } catch {
      return "";
    }
  };

  const getNotificationIcon = (type: AppNotification["type"]) => {
    switch (type) {
      case "community_message":
        return <MessageCircle className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
      case "book_idle":
        return <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "reading_reminder":
        return <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <Bell className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden text-black dark:text-white animate-in zoom-in-95 duration-200"
      >
        {/* ─── Header da Central de Notificações ─── */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center relative">
              <Bell className="w-4 h-4 text-black dark:text-white" />
              {unreadCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 absolute top-1.5 right-1.5 ring-2 ring-white dark:ring-gray-900" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm tracking-tight">Notificações</h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold">
                    {unreadCount} nova{unreadCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 block -mt-0.5">
                Comunidades, livros e lembretes
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowQuickSettings(!showQuickSettings)}
              className={`p-2 rounded-xl transition-colors ${
                showQuickSettings
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
              title="Preferências de Notificações"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ─── Painel Rápido de Preferências / Silêncio ─── */}
        {showQuickSettings && (
          <div className="px-5 py-3.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 animate-in slide-in-from-top-2 duration-150 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Modo Silencioso (Não Incomodar)</span>
              <button
                type="button"
                onClick={handleToggleMuteAll}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  settings.muteAll
                    ? "bg-black dark:bg-white text-white dark:text-black shadow-xs"
                    : "border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {settings.muteAll ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>{settings.muteAll ? "Silenciado" : "Ativo"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-gray-200/60 dark:border-gray-700/60 text-[11px]">
              <label className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 cursor-pointer">
                <span>Comunidades</span>
                <input
                  type="checkbox"
                  checked={settings.communityMessages && !settings.muteAll}
                  disabled={settings.muteAll}
                  onChange={() => handleToggleSetting("communityMessages")}
                  className="rounded text-black focus:ring-0 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 cursor-pointer">
                <span>Livros (+2 dias)</span>
                <input
                  type="checkbox"
                  checked={settings.bookIdleReminders && !settings.muteAll}
                  disabled={settings.muteAll}
                  onChange={() => handleToggleSetting("bookIdleReminders")}
                  className="rounded text-black focus:ring-0 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 cursor-pointer">
                <span>Lembrete Diário</span>
                <input
                  type="checkbox"
                  checked={settings.dailyReadingReminders && !settings.muteAll}
                  disabled={settings.muteAll}
                  onChange={() => handleToggleSetting("dailyReadingReminders")}
                  className="rounded text-black focus:ring-0 cursor-pointer"
                />
              </label>
            </div>

            <div className="flex items-center justify-between pt-1">
              <Link
                to="/settings"
                onClick={onClose}
                className="text-[11px] text-gray-500 hover:text-black dark:hover:text-white inline-flex items-center gap-1 font-medium underline"
              >
                <span>Ver todas as configurações de conta</span>
                <ChevronRight className="w-3 h-3" />
              </Link>

              {typeof window !== "undefined" && "Notification" in window && Notification.permission !== "granted" && (
                <button
                  type="button"
                  onClick={handleRequestBrowserPerm}
                  className="text-[11px] text-black dark:text-white font-bold hover:underline"
                >
                  Ativar no telemóvel
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── Aviso: Modo Silencioso Ativo ─── */}
        {settings.muteAll && !showQuickSettings && (
          <div className="px-5 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 shrink-0">
            <div className="flex items-center gap-2">
              <BellOff className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <span>Modo Não Incomodar ativo (todas as notificações silenciadas)</span>
            </div>
            <button
              onClick={handleToggleMuteAll}
              className="font-bold underline text-[11px] hover:opacity-80 shrink-0 ml-2"
            >
              Reativar
            </button>
          </div>
        )}

        {/* ─── Abas de Filtros e Ações em Massa ─── */}
        <div className="px-5 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                activeFilter === "all"
                  ? "bg-black text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                  : "text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setActiveFilter("unread")}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                activeFilter === "unread"
                  ? "bg-black text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                  : "text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Não lidas {unreadCount > 0 ? `(${unreadCount})` : ""}
            </button>
            <button
              onClick={() => setActiveFilter("community")}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                activeFilter === "community"
                  ? "bg-black text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                  : "text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Comunidades
            </button>
            <button
              onClick={() => setActiveFilter("reading")}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                activeFilter === "reading"
                  ? "bg-black text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                  : "text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Leitura
            </button>
          </div>

          {notifications.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={markAllNotificationsAsRead}
                className="p-1.5 rounded-lg text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Marcar todas como lidas"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
              <button
                onClick={clearAllNotifications}
                className="p-1.5 rounded-lg text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Limpar histórico"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ─── Lista de Notificações ─── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 divide-y divide-gray-100 dark:divide-gray-800/60">
          {filteredNotifications.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3 text-gray-400">
                <Bell className="w-6 h-6 stroke-[1.5]" />
              </div>
              <h3 className="font-bold text-sm mb-1">Sem notificações</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                {activeFilter === "unread"
                  ? "Estás em dia! Não tens mensagens ou lembretes pendentes."
                  : "Quando houver novas mensagens nos teus clubes ou livros parados, receberás avisos aqui."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const isClubMutedCurrently = item.metadata?.clubId
                ? settings.mutedClubIds.includes(item.metadata.clubId)
                : false;

              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`pt-2.5 first:pt-0 pb-2.5 px-3 rounded-2xl transition-all cursor-pointer group flex items-start gap-3 relative ${
                    item.read
                      ? "hover:bg-gray-50 dark:hover:bg-gray-800/40 opacity-75 hover:opacity-100"
                      : "bg-gray-50/70 dark:bg-gray-800/50 hover:bg-gray-100/70 dark:hover:bg-gray-800/80 font-medium"
                  }`}
                >
                  {/* Ícone com indicador de não lida */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center shadow-2xs">
                      {getNotificationIcon(item.type)}
                    </div>
                    {!item.read && (
                      <span className="w-2 h-2 rounded-full bg-black dark:bg-white absolute -top-0.5 -right-0.5 ring-2 ring-white dark:ring-gray-900" />
                    )}
                  </div>

                  {/* Conteúdo da Notificação */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <h4 className={`text-xs truncate ${!item.read ? "font-bold text-black dark:text-white" : "font-semibold text-gray-700 dark:text-gray-300"}`}>
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>

                    {/* Ações contextuais de rodapé do cartão */}
                    <div className="flex items-center gap-2 mt-2">
                      {item.link && (
                        <span className="text-[10px] font-semibold text-black dark:text-white inline-flex items-center gap-1 group-hover:underline">
                          <span>Abrir</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      )}

                      {item.type === "community_message" && item.metadata?.clubId && (
                        <button
                          type="button"
                          onClick={(e) => handleToggleMuteClub(e, item.metadata!.clubId!)}
                          className="text-[10px] text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-gray-200/60 dark:hover:bg-gray-700 transition-colors ml-auto"
                          title={isClubMutedCurrently ? "Reativar notificações deste clube" : "Silenciar este clube"}
                        >
                          {isClubMutedCurrently ? (
                            <>
                              <Volume2 className="w-2.5 h-2.5" />
                              <span>Reativar clube</span>
                            </>
                          ) : (
                            <>
                              <VolumeX className="w-2.5 h-2.5" />
                              <span>Silenciar clube</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Botão de eliminar individual */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(item.id);
                    }}
                    className="absolute top-2.5 right-2 p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors opacity-0 group-hover:opacity-100"
                    title="Remover notificação"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
