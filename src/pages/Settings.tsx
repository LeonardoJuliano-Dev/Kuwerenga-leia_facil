import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Moon,
  Sun,
  Laptop,
  Languages,
  MessageCircle,
  AlertTriangle,
  Check,
  RotateCcw,
  Trash2,
  Lock,
  ChevronRight,
  Bell,
  BellOff,
  BookOpen,
  Users,
  Smartphone,
  Shield
} from "lucide-react";
import BottomNav from "../components/BottomNav";
import { supabase } from "../lib/supabase";
import { isGuestMode } from "../lib/guestMode";
import { applyTheme as setGlobalTheme, getStoredTheme, type AppTheme } from "../lib/theme";
import { checkIsAdmin, setLocalAdminMode } from "../lib/storeService";
import {
  getNotificationSettings,
  saveNotificationSettings,
  requestBrowserNotificationPermission,
  toggleMuteClub,
  syncWithServiceWorkerForBackground,
  type NotificationSettings
} from "../lib/notificationService";

export default function Settings() {
  const [isGuest, setIsGuest] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // ─── 1. Tema ───
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(getStoredTheme);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkIsAdmin().then((res) => setIsAdmin(res));
  }, []);

  const handleToggleAdminMode = () => {
    const next = !isAdmin;
    setLocalAdminMode(next);
    setIsAdmin(next);
  };

  const handleSelectTheme = (theme: AppTheme) => {
    setCurrentTheme(theme);
    setGlobalTheme(theme);
  };

  // ─── 2. Definições de Notificações ───
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(getNotificationSettings);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(() => {
    return typeof Notification !== "undefined" ? Notification.permission : "default";
  });

  const handleUpdateNotifSettings = (patch: Partial<NotificationSettings>) => {
    const updated = saveNotificationSettings(patch);
    setNotifSettings({ ...updated });
    syncWithServiceWorkerForBackground();
  };

  const handleRequestBrowserPermission = async () => {
    const granted = await requestBrowserNotificationPermission();
    if (typeof Notification !== "undefined") {
      setBrowserPermission(Notification.permission);
    }
    handleUpdateNotifSettings({ browserNotifications: granted });
    syncWithServiceWorkerForBackground();
  };

  const handleUnmuteClub = (clubId: string) => {
    toggleMuteClub(clubId);
    setNotifSettings(getNotificationSettings());
  };

  // ─── 3. Eliminação de Conta (Período de 7 dias) ───
  const [scheduledDeleteAt, setScheduledDeleteAt] = useState<string | null>(null);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  useEffect(() => {
    if (isGuestMode()) {
      setIsGuest(true);
      return;
    }

    async function checkAccountStatus() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          // Verificar se há exclusão agendada na tabela profiles ou metadata
          const { data: profile } = await supabase
            .from("profiles")
            .select("scheduled_delete_at")
            .eq("id", user.id)
            .maybeSingle();

          const localScheduled = localStorage.getItem(`scheduled_delete_${user.id}`);
          if (profile?.scheduled_delete_at) {
            setScheduledDeleteAt(profile.scheduled_delete_at);
          } else if (localScheduled) {
            setScheduledDeleteAt(localScheduled);
          }
        }
      } catch (err) {
        console.error("Erro ao verificar estado da conta:", err);
      }
    }

    checkAccountStatus();
  }, []);

  // Agendar eliminação para daqui a 7 dias
  const handleScheduleDelete = async () => {
    setProcessingAction(true);
    try {
      const targetDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      if (userId) {
        localStorage.setItem(`scheduled_delete_${userId}`, targetDate);
        // Tenta atualizar no Supabase se existir a coluna
        await supabase
          .from("profiles")
          .update({ scheduled_delete_at: targetDate })
          .eq("id", userId);
      } else {
        localStorage.setItem("guest_scheduled_delete", targetDate);
      }

      setScheduledDeleteAt(targetDate);
      setShowConfirmDeleteModal(false);
    } catch (err) {
      console.error("Erro ao agendar eliminação:", err);
    } finally {
      setProcessingAction(false);
    }
  };

  // Cancelar eliminação / Recuperar conta
  const handleCancelDelete = async () => {
    setProcessingAction(true);
    try {
      if (userId) {
        localStorage.removeItem(`scheduled_delete_${userId}`);
        await supabase
          .from("profiles")
          .update({ scheduled_delete_at: null })
          .eq("id", userId);
      } else {
        localStorage.removeItem("guest_scheduled_delete");
      }
      setScheduledDeleteAt(null);
    } catch (err) {
      console.error("Erro ao cancelar eliminação:", err);
    } finally {
      setProcessingAction(false);
    }
  };

  const formattedScheduledDate = scheduledDeleteAt
    ? new Date(scheduledDeleteAt).toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white pb-24 md:pb-12 md:pt-16">
      
      {/* Top Bar */}
      <header className="px-4 sm:px-6 pt-safe sticky top-0 z-10 bg-white/95 dark:bg-black/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-900">
        <div className="app-container pt-6 sm:pt-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/profile"
              className="p-2 -ml-2 rounded-xl text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
              title="Voltar ao Perfil"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold leading-tight">Configurações</h1>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Preferências de visualização e conta
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 sm:px-6 py-6 app-container space-y-6">
        
        {/* Banner de Aviso: Conta com Eliminação Agendada */}
        {scheduledDeleteAt && (
          <div className="p-5 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm">Eliminação de Conta Agendada</h3>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                  A tua conta será eliminada permanentemente em <strong>{formattedScheduledDate}</strong> (período de carência de 7 dias). Enquanto este prazo não terminar, podes recuperar a tua conta e cancelar o processo a qualquer momento.
                </p>
              </div>
            </div>

            <button
              onClick={handleCancelDelete}
              disabled={processingAction}
              className="w-full py-2.5 px-4 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Cancelar Eliminação & Recuperar Conta</span>
            </button>
          </div>
        )}

        {/* ─── 1. Tema da Aplicação ─── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
            Aparência & Tema
          </h2>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => handleSelectTheme("light")}
              className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                currentTheme === "light"
                  ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black font-bold shadow-xs scale-[1.02]"
                  : "border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white"
              }`}
            >
              <Sun className="w-5 h-5 stroke-[2]" />
              <span className="text-xs">Claro</span>
              <span className="text-[9px] font-semibold opacity-70 uppercase tracking-wider">Sépia</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTheme("dark")}
              className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                currentTheme === "dark"
                  ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black font-bold shadow-xs scale-[1.02]"
                  : "border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white"
              }`}
            >
              <Moon className="w-5 h-5 stroke-[2]" />
              <span className="text-xs">Escuro</span>
              <span className="text-[9px] font-semibold opacity-70 uppercase tracking-wider">Puro</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTheme("system")}
              className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                currentTheme === "system"
                  ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black font-bold shadow-xs scale-[1.02]"
                  : "border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white"
              }`}
            >
              <Laptop className="w-5 h-5 stroke-[2]" />
              <span className="text-xs">Sistema</span>
              <span className="text-[9px] font-semibold opacity-70 uppercase tracking-wider">Auto</span>
            </button>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">
            O modo claro utiliza uma tonalidade sépia quente inspirada em papel nobre de livro, reduzindo o brilho ofuscante e protegendo a visão em leituras prolongadas.
          </p>
        </div>

        {/* ─── 2. Notificações & Lembretes ─── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Notificações & Lembretes
              </h2>
            </div>
            {notifSettings.muteAll && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 flex items-center gap-1">
                <BellOff className="w-2.5 h-2.5" />
                Silêncio Total
              </span>
            )}
          </div>

          {/* Toggle Principal: Silenciar Tudo (Não Incomodar) */}
          <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 flex items-center justify-between gap-3">
            <div>
              <span className="font-semibold text-xs block text-black dark:text-white">
                Silenciar todas as notificações
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                Pausa temporariamente todos os alertas de comunidades e de leitura
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleUpdateNotifSettings({ muteAll: !notifSettings.muteAll })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                notifSettings.muteAll ? "bg-red-500" : "bg-gray-300 dark:bg-gray-700"
              }`}
              aria-label="Alternar silêncio total"
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  notifSettings.muteAll ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Toggles por Categoria */}
          <div className={`space-y-2.5 transition-opacity ${notifSettings.muteAll ? "opacity-40 pointer-events-none" : ""}`}>
            
            {/* Mensagens de Comunidades */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-medium text-xs block text-black dark:text-white">
                    Mensagens em Comunidades
                  </span>
                  <span className="text-[10px] text-gray-500 block">
                    Novas conversas nos clubes em que participas
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleUpdateNotifSettings({ communityMessages: !notifSettings.communityMessages })}
                className={`w-10 h-5.5 rounded-full transition-colors relative shrink-0 ${
                  notifSettings.communityMessages ? "bg-black dark:bg-white" : "bg-gray-300 dark:bg-gray-700"
                }`}
                aria-label="Alternar notificações de comunidades"
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-transform absolute top-1 ${
                    notifSettings.communityMessages
                      ? "translate-x-5.5 bg-white dark:bg-black"
                      : "translate-x-1 bg-white"
                  }`}
                />
              </button>
            </div>

            {/* Livros sem ler (+ de 2 dias) */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-medium text-xs block text-black dark:text-white">
                    Livros em Pausa (+ de 2 dias)
                  </span>
                  <span className="text-[10px] text-gray-500 block">
                    Lembrete amigável quando um livro não é lido há mais de 48h
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleUpdateNotifSettings({ bookIdleReminders: !notifSettings.bookIdleReminders })}
                className={`w-10 h-5.5 rounded-full transition-colors relative shrink-0 ${
                  notifSettings.bookIdleReminders ? "bg-black dark:bg-white" : "bg-gray-300 dark:bg-gray-700"
                }`}
                aria-label="Alternar lembretes de livros em pausa"
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-transform absolute top-1 ${
                    notifSettings.bookIdleReminders
                      ? "translate-x-5.5 bg-white dark:bg-black"
                      : "translate-x-1 bg-white"
                  }`}
                />
              </button>
            </div>

            {/* Lembretes Diários de Leitura */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-medium text-xs block text-black dark:text-white">
                    Lembretes Diários de Leitura
                  </span>
                  <span className="text-[10px] text-gray-500 block">
                    Incentivo diário para cultivar o teu hábito de ler
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleUpdateNotifSettings({ dailyReadingReminders: !notifSettings.dailyReadingReminders })}
                className={`w-10 h-5.5 rounded-full transition-colors relative shrink-0 ${
                  notifSettings.dailyReadingReminders ? "bg-black dark:bg-white" : "bg-gray-300 dark:bg-gray-700"
                }`}
                aria-label="Alternar lembretes diários de leitura"
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-transform absolute top-1 ${
                    notifSettings.dailyReadingReminders
                      ? "translate-x-5.5 bg-white dark:bg-black"
                      : "translate-x-1 bg-white"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Permissão do Navegador / Telemóvel */}
          <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 text-gray-500 shrink-0" />
              <div>
                <span className="font-semibold text-xs block text-black dark:text-white">
                  Notificações no Dispositivo
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 block">
                  {browserPermission === "granted"
                    ? "Ativas mesmo com a aplicação fechada em segundo plano"
                    : browserPermission === "denied"
                    ? "Bloqueadas no sistema (ativa nas definições de notificações do dispositivo)"
                    : "Recebe lembretes e alertas mesmo com o telemóvel bloqueado"}
                </span>
              </div>
            </div>
            {browserPermission === "granted" ? (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
                Ativas em Segundo Plano
              </span>
            ) : (
              <button
                type="button"
                onClick={handleRequestBrowserPermission}
                className="px-3.5 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black font-semibold text-xs active:scale-95 transition-all shadow-xs shrink-0"
              >
                Ativar no Telemóvel
              </button>
            )}
          </div>

          {/* Comunidades Silenciadas Individualmente */}
          {notifSettings.mutedClubIds.length > 0 && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <span className="text-[11px] font-semibold text-gray-500 block">
                Comunidades silenciadas ({notifSettings.mutedClubIds.length})
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {notifSettings.mutedClubIds.map((cid) => (
                  <div
                    key={cid}
                    className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-100 dark:bg-gray-800/60 text-xs"
                  >
                    <span className="text-gray-600 dark:text-gray-300 font-mono text-[11px] truncate max-w-[200px]">
                      Clube #{cid.slice(0, 8)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUnmuteClub(cid)}
                      className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      Reativar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── 3. Idioma da Aplicação ─── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Languages className="w-4 h-4 text-gray-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Idioma do Sistema
            </h2>
          </div>

          <div className="space-y-2">
            {/* Português (Ativo) */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-black dark:border-white bg-gray-50 dark:bg-gray-800/60 font-semibold text-xs">
              <div className="flex items-center gap-2.5">
                <span>Português (Padrão)</span>
              </div>
              <Check className="w-4 h-4 stroke-[2.5]" />
            </div>

            {/* Inglês (Não disponível) */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 text-xs cursor-not-allowed bg-gray-50/40 dark:bg-gray-900/30">
              <div className="flex items-center gap-2.5">
                <span>English (Inglês)</span>
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700">
                Não disponível
              </span>
            </div>
          </div>
        </div>

        {/* ─── 3. Atalhos de Ajuda e Suporte ─── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
          <Link
            to="/support"
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-3.5">
              <MessageCircle className="w-5 h-5 text-gray-500" />
              <div>
                <span className="font-semibold text-xs sm:text-sm block leading-tight">
                  Suporte & Grupo do WhatsApp
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Canal comunitário para dúvidas e assistência
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Link>
        </div>

        {/* ─── 4. Privilégios de Administrador (Vendas & Moderação) ─── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Acesso & Modo Administrador
              </h2>
            </div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                isAdmin
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              {isAdmin ? "Admin Ativo" : "Utilizador"}
            </span>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Como administrador, tens acesso exclusivo para cadastrar, editar e remover livros à venda, bem como moderar qualquer livro do catálogo no ecrã de <strong>Explorar</strong>.
          </p>

          <div className="pt-1 flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
            <div>
              <span className="font-semibold text-xs block text-black dark:text-white">
                {isAdmin ? "Desativar privilégios de Admin" : "Ativar privilégios de Admin"}
              </span>
              <span className="text-[10px] text-gray-500 block">
                Alternar permissões administrativas neste dispositivo
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleAdminMode}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
                isAdmin
                  ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900 hover:bg-red-100"
                  : "bg-black dark:bg-white text-white dark:text-black hover:opacity-90"
              }`}
            >
              {isAdmin ? "Desativar" : "Ativar Modo Admin"}
            </button>
          </div>
        </div>

        {/* ─── 5. Gestão da Conta: Apagar Conta com Período de 7 dias ─── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Gestão de Conta
            </h2>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            <p>
              Caso decidas apagar a tua conta, será iniciado um <strong>período de tolerância de 7 dias</strong>. Durante esse período, os teus dados permanecem protegidos e podes cancelar o pedido e recuperar a tua conta iniciando sessão novamente.
            </p>
            <p className="mt-1.5">
              Se passarem 7 dias sem qualquer acesso, a conta e todos os dados serão eliminados de forma definitiva e irreversível.
            </p>
          </div>

          {isGuest ? (
            <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 leading-relaxed">
              Estás a navegar no modo de convidado. A sessão temporária não armazena dados de conta remota. Para usufruíres de sincronização e conta permanente, podes criar uma conta gratuita a qualquer momento.
            </div>
          ) : !scheduledDeleteAt ? (
            <button
              onClick={() => setShowConfirmDeleteModal(true)}
              className="w-full py-3 px-4 rounded-xl border border-gray-300 dark:border-gray-700 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all mt-2"
            >
              <Trash2 className="w-4 h-4 stroke-[1.8]" />
              <span>Solicitar Eliminação da Conta</span>
            </button>
          ) : (
            <button
              onClick={handleCancelDelete}
              disabled={processingAction}
              className="w-full py-3 px-4 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all mt-2"
            >
              <RotateCcw className="w-4 h-4 stroke-[2]" />
              <span>Cancelar Eliminação & Recuperar Conta</span>
            </button>
          )}
        </div>
      </main>

      {/* Modal de Confirmação de Eliminação com Carência de 7 Dias */}
      {showConfirmDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-sm w-full p-6 text-center text-black dark:text-white shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 stroke-[2]" />
            </div>
            <h3 className="font-bold text-base mb-1">Confirmar Eliminação?</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
              A eliminação só será definitiva após <strong>7 dias</strong>. Podes recuperar a tua conta e cancelar o processo a qualquer momento bastando voltar a iniciar sessão na aplicação durante esse período.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmDeleteModal(false)}
                className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={processingAction}
                onClick={handleScheduleDelete}
                className="flex-1 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold active:scale-95 transition-all shadow-xs"
              >
                {processingAction ? "A agendar..." : "Sim, Agendar (7 Dias)"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
