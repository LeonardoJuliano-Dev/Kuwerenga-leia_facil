import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  Send,
  Mic,
  Square,
  Image,
  Play,
  Pause,
  Plus,
  X,
  FileText,
  UserPlus,
  Lock,
  Shield,
  Trash2,
  Clock,
  Check,
  Globe
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { isGuestMode } from "../lib/guestMode";
import GuestRestrictionModal from "../components/GuestRestrictionModal";
import {
  determineActiveClubAdmin,
  loadClubMembers,
  loadClubJoinRequests,
  submitJoinRequest,
  approveJoinRequest,
  rejectJoinRequest,
  updateClubPrivacy,
  updateClubDetails,
  removeClubMember,
  deleteClubMessage,
  deleteClub,
  type ClubMemberItem,
  type JoinRequestItem
} from "../lib/communityService";

interface Club {
  id: string;
  name: string;
  description: string | null;
  current_goal: string | null;
  member_count: number;
  created_by?: string;
  is_public?: boolean;
}

interface MessageItem {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string | null;
  text?: string;
  media_url?: string;
  media_type?: "image" | "audio";
  duration?: number;
  chapter_reference?: string;
  created_at: string;
}

export default function ClubDetails() {
  const { id: clubId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [club, setClub] = useState<Club | null>(null);
  const [activeClubId, setActiveClubId] = useState<string | null>(clubId || null);
  const [activeTab, setActiveTab] = useState<"chat" | "forum">("chat");
  const [messages, setMessages] = useState<MessageItem[]>(() => {
    if (!clubId) return [];
    try {
      const cached = localStorage.getItem(`club_msgs_${clubId}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("Eu");
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(true);
  const [joining, setJoining] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);

  // Estados de Administrador e Gestão de Comunidade
  const [activeAdminId, setActiveAdminId] = useState<string | null>(null);
  const [clubMembers, setClubMembers] = useState<ClubMemberItem[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequestItem[]>([]);
  const [myRequestPending, setMyRequestPending] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminTab, setAdminTab] = useState<"settings" | "requests" | "members">("settings");

  // Dados editáveis no painel de administração
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editGoal, setEditGoal] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Input de Mensagem
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Gravador de Áudio (Máx 30s)
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  // Player de Áudio
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Modal de Novo Tópico no Fórum
  const [showForumModal, setShowForumModal] = useState(false);
  const [chapterRef, setChapterRef] = useState("");
  const [forumTitle, setForumTitle] = useState("");
  const [forumContent, setForumContent] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = Boolean(currentUserId && activeAdminId && currentUserId === activeAdminId);

  // 1. Carregar Dados do Clube, Membros e Mensagens
  useEffect(() => {
    if (!clubId) return;

    let isMounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) {
          setCurrentUserId(user.id);
          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", user.id)
            .maybeSingle();

          if (prof?.full_name) setCurrentUserName(prof.full_name);
          if (prof?.avatar_url) setCurrentUserAvatar(prof.avatar_url);
        }

        let effectiveId = clubId;
        const isGeneral = clubId === "geral" || clubId === "general";

        if (isGeneral) {
          // Procurar clube geral ou existente
          const { data: gClubs } = await supabase
            .from("clubs")
            .select("id, name, description, current_goal, member_count, created_by, is_public")
            .ilike("name", "%geral%")
            .limit(1);

          if (gClubs && gClubs.length > 0) {
            effectiveId = gClubs[0].id;
            if (isMounted) setClub({ ...gClubs[0], is_public: gClubs[0].is_public !== false });
          } else {
            const { data: anyClubs } = await supabase
              .from("clubs")
              .select("id, name, description, current_goal, member_count, created_by, is_public")
              .limit(1);

            if (anyClubs && anyClubs.length > 0) {
              effectiveId = anyClubs[0].id;
              if (isMounted) {
                setClub({
                  ...anyClubs[0],
                  name: "Chat Geral da Comunidade",
                  description: "Espaço aberto para todos os leitores trocarem ideias, imagens e notas de voz.",
                  current_goal: "Comunidade Aberta",
                  is_public: true,
                });
              }
            } else {
              if (isMounted) {
                setClub({
                  id: "geral",
                  name: "Chat Geral da Comunidade",
                  description: "Espaço aberto para todos os leitores trocarem ideias, imagens e notas de voz.",
                  current_goal: "Comunidade Aberta",
                  member_count: 50,
                  is_public: true,
                });
              }
            }
          }
        } else {
          // Clube específico por ID
          const { data: clubData } = await supabase
            .from("clubs")
            .select("id, name, description, current_goal, member_count, created_by, is_public")
            .eq("id", clubId)
            .single();

          if (clubData && isMounted) {
            setClub({ ...clubData, is_public: clubData.is_public !== false });
            effectiveId = clubData.id;
          }
        }

        if (isMounted) setActiveClubId(effectiveId || null);

        // 2. Carregar Membros e Determinar o Administrador Ativo (com regra de sucessão)
        if (effectiveId && effectiveId !== "geral") {
          const membersList = await loadClubMembers(effectiveId);
          if (isMounted) {
            setClubMembers(membersList);

            // Regra de sucessão: criador original ou membro mais antigo
            const creatorId = club?.created_by;
            const resolvedAdminId = determineActiveClubAdmin(creatorId, membersList);
            setActiveAdminId(resolvedAdminId);

            // Verificar se o utilizador logado é membro ativo
            if (user) {
              const myMembership = membersList.find((m) => m.user_id === user.id);
              setIsMember(Boolean(myMembership));

              // Se o utilizador é admin, carregar pedidos de adesão pendentes
              if (resolvedAdminId === user.id) {
                const reqs = await loadClubJoinRequests(effectiveId);
                setJoinRequests(reqs);
              } else {
                // Verificar se o utilizador tem pedido pendente
                const localReq = localStorage.getItem(`my_request_club_${effectiveId}`);
                if (localReq === "pending") {
                  setMyRequestPending(true);
                }
              }
            }
          }
        }

        // 3. Carregar Mensagens do Clube (com nome e avatar de perfil)
        if (effectiveId && effectiveId !== "geral") {
          const { data: discData, error } = await supabase
            .from("club_discussions")
            .select(`
              id,
              user_id,
              message,
              chapter_reference,
              created_at,
              profile:profiles (
                id,
                full_name,
                avatar_url
              )
            `)
            .eq("club_id", effectiveId)
            .order("created_at", { ascending: true });

          if (!error && discData && isMounted) {
            const parsedMessages: MessageItem[] = discData.map((d: any) => {
              let itemText = d.message;
              let mediaUrl: string | undefined = undefined;
              let mediaType: "image" | "audio" | undefined = undefined;
              let duration: number | undefined = undefined;

              if (d.message && d.message.startsWith("{") && d.message.includes('"media_type"')) {
                try {
                  const parsed = JSON.parse(d.message);
                  itemText = parsed.text || "";
                  mediaUrl = parsed.media_url;
                  mediaType = parsed.media_type;
                  duration = parsed.duration;
                } catch {
                  itemText = d.message;
                }
              }

              return {
                id: d.id,
                user_id: d.user_id,
                user_name: d.profile?.full_name || "Leitor",
                user_avatar: d.profile?.avatar_url || null,
                text: itemText,
                media_url: mediaUrl,
                media_type: mediaType,
                duration,
                chapter_reference: d.chapter_reference,
                created_at: d.created_at,
              };
            });

            setMessages(parsedMessages);
            try {
              localStorage.setItem(`club_msgs_${effectiveId}`, JSON.stringify(parsedMessages));
            } catch {}
          }
        }
      } catch (err) {
        console.error("Erro ao carregar clube:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [clubId]);

  // Atualizar valores do modal de administração quando o clube muda
  useEffect(() => {
    if (club) {
      setEditName(club.name);
      setEditDesc(club.description || "");
      setEditGoal(club.current_goal || "");
      setEditIsPublic(club.is_public !== false);
    }
  }, [club]);

  // Realtime subscription para mensagens ao vivo (INSERT e DELETE)
  useEffect(() => {
    if (!activeClubId || activeClubId === "geral") return;

    const channel = supabase
      .channel(`club_chat_${activeClubId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "club_discussions",
          filter: `club_id=eq.${activeClubId}`,
        },
        async (payload) => {
          const newRow: any = payload.new;
          if (!newRow) return;

          // Busca perfil do autor para ter nome e avatar imediatos
          let authorName = "Leitor";
          let authorAvatar: string | null = null;
          try {
            const { data: prof } = await supabase
              .from("profiles")
              .select("full_name, avatar_url")
              .eq("id", newRow.user_id)
              .maybeSingle();
            if (prof?.full_name) authorName = prof.full_name;
            if (prof?.avatar_url) authorAvatar = prof.avatar_url;
          } catch {}

          setMessages((prev) => {
            if (prev.some((m) => m.id === newRow.id)) return prev;

            let itemText = newRow.message;
            let mediaUrl: string | undefined = undefined;
            let mediaType: "image" | "audio" | undefined = undefined;
            let duration: number | undefined = undefined;

            if (itemText && itemText.startsWith("{") && itemText.includes('"media_type"')) {
              try {
                const parsed = JSON.parse(itemText);
                itemText = parsed.text || "";
                mediaUrl = parsed.media_url;
                mediaType = parsed.media_type;
                duration = parsed.duration;
              } catch {
                itemText = newRow.message;
              }
            }

            const incoming: MessageItem = {
              id: newRow.id,
              user_id: newRow.user_id,
              user_name: newRow.user_id === currentUserId ? currentUserName : authorName,
              user_avatar: newRow.user_id === currentUserId ? currentUserAvatar : authorAvatar,
              text: itemText,
              media_url: mediaUrl,
              media_type: mediaType,
              duration,
              chapter_reference: newRow.chapter_reference,
              created_at: newRow.created_at,
            };

            const updated = [...prev, incoming];
            try {
              localStorage.setItem(`club_msgs_${activeClubId}`, JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "club_discussions",
          filter: `club_id=eq.${activeClubId}`,
        },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setMessages((prev) => {
              const filtered = prev.filter((m) => m.id !== deletedId);
              try {
                localStorage.setItem(`club_msgs_${activeClubId}`, JSON.stringify(filtered));
              } catch {}
              return filtered;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeClubId, currentUserId, currentUserName, currentUserAvatar]);

  // Scroll automático para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  // ─── Aderir ao Clube ou Pedir Entrada em Grupo Privado ───
  const handleJoinClub = async () => {
    if (isGuestMode()) {
      setShowGuestModal(true);
      return;
    }
    if (!currentUserId || !activeClubId || activeClubId === "geral") return;

    setJoining(true);
    try {
      // Se for privado, submete pedido de adesão
      if (club?.is_public === false) {
        await submitJoinRequest(activeClubId, currentUserId, currentUserName);
        setMyRequestPending(true);
        alert("O teu pedido de adesão foi enviado. O administrador irá confirmar a tua entrada.");
      } else {
        // Se for público, entra diretamente
        await supabase.from("club_members").insert({
          club_id: activeClubId,
          user_id: currentUserId,
          role: "member",
        });
        setIsMember(true);
        if (club) setClub({ ...club, member_count: club.member_count + 1 });
        const updatedMembers = await loadClubMembers(activeClubId);
        setClubMembers(updatedMembers);
      }
    } catch (err) {
      console.error("Erro ao aderir:", err);
    } finally {
      setJoining(false);
    }
  };

  // ─── Apagar Mensagem do Chat (Pelo Autor ou pelo Administrador) ───
  const handleDeleteMessage = async (msgId: string) => {
    if (!confirm("Eliminar esta mensagem do chat da comunidade?")) return;

    // Atualização otimista
    setMessages((prev) => {
      const filtered = prev.filter((m) => m.id !== msgId);
      if (activeClubId) {
        try {
          localStorage.setItem(`club_msgs_${activeClubId}`, JSON.stringify(filtered));
        } catch {}
      }
      return filtered;
    });

    try {
      await deleteClubMessage(msgId);
    } catch (err) {
      console.error("Erro ao apagar mensagem:", err);
    }
  };

  // ─── Gravação de Áudio (Máx 30 Segundos) ───
  const startRecording = async () => {
    if (isGuestMode()) {
      setShowGuestModal(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        await sendAudioMessage(audioBlob, recordSeconds || 1);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordSeconds(0);

      let count = 0;
      recordTimerRef.current = setInterval(() => {
        count += 1;
        setRecordSeconds(count);
        if (count >= 30) {
          stopRecording();
        }
      }, 1000);
    } catch (err) {
      console.error("Erro ao aceder ao microfone:", err);
      alert("Permite o acesso ao microfone no navegador para gravar áudios.");
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordSeconds(0);
  };

  const sendAudioMessage = async (audioBlob: Blob, duration: number) => {
    if (!currentUserId) return;

    setSending(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const cappedDuration = Math.min(30, Math.max(1, duration));

        const payload = JSON.stringify({
          text: "",
          media_url: base64Audio,
          media_type: "audio",
          duration: cappedDuration,
        });

        const targetId = activeClubId && activeClubId !== "geral" ? activeClubId : null;
        let insertedId = "audio-" + Date.now();

        if (targetId) {
          const { data: inserted } = await supabase
            .from("club_discussions")
            .insert({
              club_id: targetId,
              user_id: currentUserId,
              message: payload,
            })
            .select()
            .single();

          if (inserted) insertedId = inserted.id;
        }

        const newMsg: MessageItem = {
          id: insertedId,
          user_id: currentUserId,
          user_name: currentUserName,
          user_avatar: currentUserAvatar,
          media_url: base64Audio,
          media_type: "audio",
          duration: cappedDuration,
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => {
          const updated = [...prev, newMsg];
          if (activeClubId) {
            try {
              localStorage.setItem(`club_msgs_${activeClubId}`, JSON.stringify(updated));
            } catch {}
          }
          return updated;
        });
      };
    } catch (err) {
      console.error("Erro ao enviar áudio:", err);
    } finally {
      setSending(false);
    }
  };

  // ─── Enviar Mensagem de Texto e Foto ───
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuestMode()) {
      setShowGuestModal(true);
      return;
    }
    if ((!inputText.trim() && !selectedImage) || !currentUserId) return;

    setSending(true);
    try {
      let mediaBase64: string | undefined = undefined;

      if (selectedImage) {
        mediaBase64 = await new Promise((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.readAsDataURL(selectedImage);
        });
      }

      const payload = mediaBase64
        ? JSON.stringify({
            text: inputText.trim(),
            media_url: mediaBase64,
            media_type: "image",
          })
        : inputText.trim();

      const targetId = activeClubId && activeClubId !== "geral" ? activeClubId : null;
      let insertedId = "msg-" + Date.now();

      if (targetId) {
        const { data: inserted } = await supabase
          .from("club_discussions")
          .insert({
            club_id: targetId,
            user_id: currentUserId,
            message: payload,
          })
          .select()
          .single();

        if (inserted) insertedId = inserted.id;
      }

      const newMsg: MessageItem = {
        id: insertedId,
        user_id: currentUserId,
        user_name: currentUserName,
        user_avatar: currentUserAvatar,
        text: inputText.trim(),
        media_url: mediaBase64,
        media_type: mediaBase64 ? "image" : undefined,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => {
        const updated = [...prev, newMsg];
        if (activeClubId) {
          try {
            localStorage.setItem(`club_msgs_${activeClubId}`, JSON.stringify(updated));
          } catch {}
        }
        return updated;
      });

      setInputText("");
      setSelectedImage(null);
      setImagePreview(null);
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
    } finally {
      setSending(false);
    }
  };

  // ─── Criar Tópico no Fórum ───
  const handleCreateForumTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forumTitle.trim() || !forumContent.trim() || !currentUserId || !activeClubId) return;

    setSending(true);
    try {
      const formattedContent = `${forumTitle.trim()}\n\n${forumContent.trim()}`;
      const { data: inserted, error } = await supabase
        .from("club_discussions")
        .insert({
          club_id: activeClubId,
          user_id: currentUserId,
          message: formattedContent,
          chapter_reference: chapterRef.trim() || "Discussão Geral",
        })
        .select()
        .single();

      if (error) throw error;

      const newMsg: MessageItem = {
        id: inserted ? inserted.id : "forum-" + Date.now(),
        user_id: currentUserId,
        user_name: currentUserName,
        user_avatar: currentUserAvatar,
        text: formattedContent,
        chapter_reference: chapterRef.trim() || "Discussão Geral",
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, newMsg]);
      setForumTitle("");
      setForumContent("");
      setChapterRef("");
      setShowForumModal(false);
      setActiveTab("forum");
    } catch (err) {
      console.error("Erro ao criar tópico:", err);
    } finally {
      setSending(false);
    }
  };

  // ─── Ações do Administrador ───
  const handleSaveAdminSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClubId || !isAdmin) return;

    setSavingAdmin(true);
    try {
      await updateClubPrivacy(activeClubId, editIsPublic);
      await updateClubDetails(activeClubId, {
        name: editName,
        description: editDesc,
        current_goal: editGoal,
      });

      if (club) {
        setClub({
          ...club,
          name: editName,
          description: editDesc,
          current_goal: editGoal,
          is_public: editIsPublic,
        });
      }
      alert("Configurações da comunidade atualizadas com sucesso.");
      setShowAdminModal(false);
    } catch (err) {
      console.error("Erro ao salvar configurações do admin:", err);
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleApproveRequest = async (request: JoinRequestItem) => {
    if (!activeClubId) return;
    const ok = await approveJoinRequest(request.id, activeClubId, request.user_id);
    if (ok) {
      setJoinRequests((prev) => prev.filter((r) => r.id !== request.id));
      const updatedMembers = await loadClubMembers(activeClubId);
      setClubMembers(updatedMembers);
      if (club) setClub({ ...club, member_count: club.member_count + 1 });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!activeClubId) return;
    const ok = await rejectJoinRequest(requestId, activeClubId);
    if (ok) {
      setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
    }
  };

  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    if (!activeClubId || !isAdmin) return;
    if (memberUserId === currentUserId) {
      alert("Não podes expulsar-te a ti próprio. Para sair, transfere ou encerra o clube.");
      return;
    }

    if (!confirm(`Tens a certeza de que desejas remover "${memberName}" da comunidade?`)) return;

    const ok = await removeClubMember(activeClubId, memberUserId);
    if (ok) {
      setClubMembers((prev) => prev.filter((m) => m.user_id !== memberUserId));
      if (club) setClub({ ...club, member_count: Math.max(1, club.member_count - 1) });
    }
  };

  const handleDeleteClubPermanently = async () => {
    if (!activeClubId || !isAdmin) return;
    if (!confirm("AVISO PERMANENTE: Tens a certeza de que desejas apagar esta comunidade? Todas as discussões e membros serão removidos.")) return;

    const ok = await deleteClub(activeClubId);
    if (ok) {
      alert("Comunidade eliminada.");
      navigate("/community");
    }
  };

  // Reproduzir Áudio
  const togglePlayAudio = (id: string, url?: string) => {
    if (!url) return;

    if (playingAudioId === id) {
      audioPlayerRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(url);
      audioPlayerRef.current = audio;
      audio.play();
      setPlayingAudioId(id);
      audio.onended = () => setPlayingAudioId(null);
      audio.onerror = () => setPlayingAudioId(null);
    }
  };

  const forumDiscussions = messages.filter((m) => !!m.chapter_reference);
  const chatMessages = messages.filter((m) => !m.chapter_reference);

  if (loading && !club) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-white dark:bg-black text-black dark:text-white">
        <Users className="w-12 h-12 text-gray-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">Comunidade não encontrada</h2>
        <p className="text-sm text-gray-500 mb-6">Esta comunidade não existe ou foi removida pelo administrador.</p>
        <Link to="/community" className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold">
          Voltar às Comunidades
        </Link>
      </div>
    );
  }

  // Verifica se o acesso ao chat está bloqueado por ser comunidade privada
  const isPrivateLocked = club.is_public === false && !isMember && !isAdmin;

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-black text-black dark:text-white overflow-hidden select-none">
      
      {/* ─── Top Header da Comunidade ─── */}
      <header className="px-4 sm:px-6 pt-safe bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900 flex-shrink-0 z-10">
        <div className="app-container pt-5 sm:pt-7 pb-3">
          
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
              <button
                onClick={() => navigate("/community")}
                className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-base truncate">{club.name}</h1>
                  
                  {/* Badge de Privacidade */}
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 bg-gray-100 dark:bg-gray-800 text-black dark:text-white border border-gray-200 dark:border-gray-700">
                    {club.is_public !== false ? (
                      <>
                        <Globe className="w-2.5 h-2.5" />
                        <span>Pública</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-2.5 h-2.5" />
                        <span>Privada</span>
                      </>
                    )}
                  </span>
                </div>

                <span className="text-[11px] text-gray-500 dark:text-gray-400 block truncate mt-0.5">
                  {club.member_count} {club.member_count === 1 ? "membro" : "membros"} • {club.current_goal || "Comunidade de Leitura"}
                </span>
              </div>
            </div>

            {/* Ações de Cabeçalho */}
            <div className="flex items-center gap-1.5 shrink-0">
              
              {/* Botão de Painel do Administrador (apenas para o admin da comunidade) */}
              {isAdmin && (
                <button
                  onClick={() => setShowAdminModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-black dark:bg-white text-white dark:text-black shadow-xs active:scale-95 transition-transform relative"
                  title="Painel do Administrador da Comunidade"
                >
                  <Shield className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Gerir</span>
                  {joinRequests.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-white dark:bg-black absolute -top-0.5 -right-0.5 animate-pulse" />
                  )}
                </button>
              )}

              {/* Botão de Aderir / Estado de Pedido Pendente para Não-Membros */}
              {!isMember && !isAdmin && (
                club.is_public === false ? (
                  myRequestPending ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-300">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Pendente</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleJoinClub}
                      disabled={joining}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-bold active:scale-95 transition-transform shadow-xs disabled:opacity-50"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{joining ? "A pedir..." : "Pedir Entrada"}</span>
                    </button>
                  )
                ) : (
                  <button
                    onClick={handleJoinClub}
                    disabled={joining}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-bold active:scale-95 transition-transform shadow-xs disabled:opacity-50"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{joining ? "A aderir..." : "Aderir"}</span>
                  </button>
                )
              )}

              {activeTab === "forum" && isMember && (
                <button
                  onClick={() => setShowForumModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-semibold active:scale-95 transition-transform shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Tópico</span>
                </button>
              )}
            </div>
          </div>

          {/* Abas: Chat vs Fórum */}
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setActiveTab("chat")}
              className={`px-4 py-1.5 rounded-xl font-bold transition-all ${
                activeTab === "chat"
                  ? "bg-black dark:bg-white text-white dark:text-black shadow-xs"
                  : "bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-black dark:hover:text-white"
              }`}
            >
              Chat em Direto
            </button>
            <button
              onClick={() => setActiveTab("forum")}
              className={`px-4 py-1.5 rounded-xl font-bold transition-all ${
                activeTab === "forum"
                  ? "bg-black dark:bg-white text-white dark:text-black shadow-xs"
                  : "bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-black dark:hover:text-white"
              }`}
            >
              Fórum do Clube ({forumDiscussions.length})
            </button>
          </div>
        </div>
      </header>

      {/* ─── Aviso para Comunidades Privadas Trancadas ─── */}
      {isPrivateLocked ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-black dark:text-white stroke-[1.8]" />
          </div>
          <h2 className="text-xl font-extrabold mb-2">Comunidade Privada</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
            {myRequestPending
              ? "O teu pedido de adesão foi enviado com sucesso e está a aguardar confirmação pelo administrador da comunidade. Assim que for aprovado, terás acesso a todas as conversas."
              : "Este grupo é reservado. Para visualizar e participar no chat e discussões, solicita a tua entrada para ser confirmada pelo administrador."}
          </p>

          {myRequestPending ? (
            <div className="px-5 py-2.5 rounded-2xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Pedido Pendente de Aprovação</span>
            </div>
          ) : (
            <button
              onClick={handleJoinClub}
              disabled={joining}
              className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-xs font-extrabold active:scale-95 transition-transform shadow-xs flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>{joining ? "A enviar pedido..." : "Solicitar Adesão"}</span>
            </button>
          )}
        </div>
      ) : activeTab === "chat" ? (
        /* ══════════════════════════════════════════════════════════ */
        /* ÁREA 1: CHAT ESTILO TELEGRAM COM AVATAR, NOME E EXCLUSÃO  */
        /* ══════════════════════════════════════════════════════════ */
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          
          {/* Lista de Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {chatMessages.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-xs max-w-xs mx-auto">
                Ainda não há mensagens nesta comunidade. Sê o primeiro a partilhar uma ideia, foto ou gravação de voz!
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isMe = msg.user_id === currentUserId;
                const isMsgAdmin = Boolean(activeAdminId && msg.user_id === activeAdminId);
                const canDelete = isMe || isAdmin;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 sm:gap-3 group ${
                      isMe ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {/* 1. Avatar Redondo do Remetente (Estilo Telegram) */}
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                      {msg.user_avatar ? (
                        <img
                          src={msg.user_avatar}
                          alt={msg.user_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] font-black uppercase text-black dark:text-white">
                          {msg.user_name.substring(0, 2)}
                        </span>
                      )}
                    </div>

                    {/* 2. Balão da Mensagem */}
                    <div className={`max-w-[82%] sm:max-w-md flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      
                      {/* Nome do Remetente e Selo de Admin */}
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                          {isMe ? "Tu" : msg.user_name}
                        </span>
                        {isMsgAdmin && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-black text-white dark:bg-white dark:text-black tracking-wider uppercase">
                            Admin
                          </span>
                        )}
                      </div>

                      {/* Caixa Principal */}
                      <div
                        className={`relative p-3.5 rounded-2xl shadow-xs transition-all ${
                          isMe
                            ? "bg-black dark:bg-white text-white dark:text-black rounded-tr-xs"
                            : "bg-white dark:bg-gray-900 text-black dark:text-white border border-gray-100 dark:border-gray-800 rounded-tl-xs"
                        }`}
                      >
                        {/* Imagem enviada */}
                        {msg.media_type === "image" && msg.media_url && (
                          <div className="rounded-xl overflow-hidden mb-2 max-h-60 bg-gray-100 dark:bg-gray-800">
                            <img
                              src={msg.media_url}
                              alt="Foto enviada"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {/* Áudio (até 30s) */}
                        {msg.media_type === "audio" && msg.media_url && (
                          <div className="flex items-center gap-3 py-1">
                            <button
                              type="button"
                              onClick={() => togglePlayAudio(msg.id, msg.media_url)}
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                                isMe
                                  ? "bg-white text-black dark:bg-black dark:text-white"
                                  : "bg-black text-white dark:bg-white dark:text-black"
                              }`}
                            >
                              {playingAudioId === msg.id ? (
                                <Pause className="w-5 h-5 fill-current" />
                              ) : (
                                <Play className="w-5 h-5 fill-current ml-0.5" />
                              )}
                            </button>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold">Mensagem de Voz</span>
                                <span className="text-[10px] opacity-70">
                                  {msg.duration ? `${msg.duration}s` : "Áudio"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 mt-1 opacity-60">
                                <div className="w-1 h-3 bg-current rounded-full animate-pulse"></div>
                                <div className="w-1 h-5 bg-current rounded-full"></div>
                                <div className="w-1 h-2 bg-current rounded-full"></div>
                                <div className="w-1 h-4 bg-current rounded-full"></div>
                                <div className="w-1 h-6 bg-current rounded-full"></div>
                                <div className="w-1 h-3 bg-current rounded-full"></div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Texto */}
                        {msg.text && (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        )}

                        {/* Rodapé da Mensagem: Horário e Botão de Apagar */}
                        <div className="flex items-center justify-between gap-3 mt-1.5 pt-1 border-t border-black/10 dark:border-white/10 text-[9px] opacity-75">
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>

                          {/* Botão de Apagar Mensagem (Autor ou Administrador) */}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                              title={isAdmin && !isMe ? "Apagar mensagem (como Administrador)" : "Apagar a minha mensagem"}
                            >
                              <Trash2 className="w-3 h-3 stroke-[2]" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Pré-visualização de Imagem Anexada */}
          {imagePreview && (
            <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={imagePreview} alt="Preview" className="w-12 h-12 rounded-xl object-cover" />
                <span className="text-xs text-gray-500 truncate max-w-xs">{selectedImage?.name}</span>
              </div>
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setImagePreview(null);
                }}
                className="p-1 rounded-full text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Barra de Envio (Texto, Microfone e Foto) */}
          <footer className="p-3 sm:p-4 bg-white dark:bg-black border-t border-gray-100 dark:border-gray-900 flex-shrink-0">
            {isRecording ? (
              <div className="flex items-center justify-between p-2 rounded-2xl bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-black dark:bg-white animate-ping"></div>
                  <span className="text-xs font-bold text-black dark:text-white">
                    A gravar áudio: {recordSeconds}s / 30s
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-black dark:hover:text-white font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="p-2 rounded-full bg-black dark:bg-white text-white dark:text-black shadow-xs"
                    title="Enviar áudio"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                </div>
              </div>
            ) : isGuestMode() ? (
              <div className="flex items-center justify-between gap-3 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Lock className="w-4 h-4 text-black dark:text-white shrink-0" />
                  <span>Estás a visualizar em Modo Convidado.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuestModal(true)}
                  className="px-3.5 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold active:scale-95 transition-transform shrink-0"
                >
                  Entrar para Conversar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                {/* Botão de Anexar Foto */}
                <label className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                  <Image className="w-5 h-5" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedImage(file);
                        setImagePreview(URL.createObjectURL(file));
                      }
                    }}
                    className="hidden"
                  />
                </label>

                {/* Input de Texto */}
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Escreve uma mensagem para a comunidade..."
                  className="flex-1 bg-gray-100 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-medium text-black dark:text-white"
                />

                {/* Botão de Gravação de Áudio (até 30s) */}
                {!inputText.trim() && !selectedImage ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="p-3 bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 text-black dark:text-white rounded-2xl transition-transform active:scale-95"
                    title="Gravar áudio (máx 30s)"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={sending}
                    className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                )}
              </form>
            )}
          </footer>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════ */
        /* ÁREA 2: FÓRUM / DISCUSSÕES POR CAPÍTULO                   */
        /* ══════════════════════════════════════════════════════════ */
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {forumDiscussions.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 text-center my-6">
              <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-base mb-1">Sem tópicos no fórum</h3>
              <p className="text-xs text-gray-500 mb-6 max-w-xs mx-auto">
                Cria o primeiro debate sobre um capítulo específico ou ideia central da leitura!
              </p>
              <button
                onClick={() => {
                  if (isGuestMode()) {
                    setShowGuestModal(true);
                  } else {
                    setShowForumModal(true);
                  }
                }}
                className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold"
              >
                Criar Novo Tópico
              </button>
            </div>
          ) : (
            forumDiscussions.map((topic) => (
              <div
                key={topic.id}
                className="p-5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60 shadow-xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    {topic.chapter_reference}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(topic.created_at).toLocaleDateString("pt-PT")}
                  </span>
                </div>
                <h4 className="font-bold text-sm mb-1.5">{topic.user_name}</h4>
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                  {topic.text}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Modal de Administração da Comunidade ─── */}
      {showAdminModal && isAdmin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-black dark:text-white max-h-[90vh] flex flex-col">
            
            {/* Topo do Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-900 shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                <h3 className="font-extrabold text-base">Painel do Administrador</h3>
              </div>
              <button
                onClick={() => setShowAdminModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Abas do Administrador */}
            <div className="flex gap-2 py-3 border-b border-gray-100 dark:border-gray-900 shrink-0 text-xs font-bold">
              <button
                onClick={() => setAdminTab("settings")}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  adminTab === "settings"
                    ? "bg-black dark:bg-white text-white dark:text-black"
                    : "bg-gray-100 dark:bg-gray-900 text-gray-500"
                }`}
              >
                Configurações
              </button>
              <button
                onClick={() => setAdminTab("requests")}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  adminTab === "requests"
                    ? "bg-black dark:bg-white text-white dark:text-black"
                    : "bg-gray-100 dark:bg-gray-900 text-gray-500"
                }`}
              >
                <span>Pedidos Pendentes</span>
                {joinRequests.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-white text-black dark:bg-black dark:text-white">
                    {joinRequests.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setAdminTab("members")}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  adminTab === "members"
                    ? "bg-black dark:bg-white text-white dark:text-black"
                    : "bg-gray-100 dark:bg-gray-900 text-gray-500"
                }`}
              >
                Membros ({clubMembers.length})
              </button>
            </div>

            {/* Conteúdo da Aba */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              
              {/* ABA 1: CONFIGURAÇÕES DE PRIVACIDADE E DADOS */}
              {adminTab === "settings" && (
                <form onSubmit={handleSaveAdminSettings} className="space-y-4">
                  {/* Seletor de Privacidade */}
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                      Privacidade da Comunidade
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditIsPublic(true)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          editIsPublic
                            ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-xs"
                            : "bg-white dark:bg-black border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                          <Globe className="w-3.5 h-3.5" />
                          <span>Pública</span>
                        </div>
                        <span className="text-[10px] block opacity-80 leading-tight">
                          Qualquer leitor pode entrar e participar livremente.
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditIsPublic(false)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          !editIsPublic
                            ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-xs"
                            : "bg-white dark:bg-black border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Privada</span>
                        </div>
                        <span className="text-[10px] block opacity-80 leading-tight">
                          Apenas membros aprovados pelo administrador podem entrar.
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Nome da Comunidade */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                      Nome da Comunidade *
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    />
                  </div>

                  {/* Descrição */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                      Descrição
                    </label>
                    <textarea
                      rows={3}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Sobre o que é este grupo..."
                      className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
                    />
                  </div>

                  {/* Meta / Objetivo */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                      Meta de Leitura ou Objetivo
                    </label>
                    <input
                      type="text"
                      value={editGoal}
                      onChange={(e) => setEditGoal(e.target.value)}
                      placeholder="Ex: Ler 1 livro por mês"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={savingAdmin}
                      className="w-full py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold active:scale-95 transition-transform disabled:opacity-50"
                    >
                      {savingAdmin ? "A guardar..." : "Guardar Alterações"}
                    </button>
                  </div>

                  {/* Zona de Perigo: Eliminar Clube */}
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-900">
                    <button
                      type="button"
                      onClick={handleDeleteClubPermanently}
                      className="w-full py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar Comunidade Permanentemente</span>
                    </button>
                  </div>
                </form>
              )}

              {/* ABA 2: PEDIDOS DE ADESÃO PENDENTES */}
              {adminTab === "requests" && (
                <div className="space-y-3">
                  {joinRequests.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-xs">
                      Não há pedidos de adesão pendentes no momento.
                    </div>
                  ) : (
                    joinRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                            {req.avatar_url ? (
                              <img src={req.avatar_url} alt={req.full_name} className="w-full h-full object-cover" />
                            ) : (
                              req.full_name.substring(0, 2)
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-xs block truncate">{req.full_name}</span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(req.created_at).toLocaleDateString("pt-PT")}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleApproveRequest(req)}
                            className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold active:scale-95 transition-transform"
                            title="Aprovar entrada"
                          >
                            <Check className="w-3.5 h-3.5 inline mr-1" />
                            <span>Aprovar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectRequest(req.id)}
                            className="px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-black dark:hover:text-white rounded-xl text-xs font-semibold"
                            title="Recusar pedido"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ABA 3: MEMBROS DA COMUNIDADE */}
              {adminTab === "members" && (
                <div className="space-y-3">
                  {clubMembers.map((member) => {
                    const isMemberAdmin = member.user_id === activeAdminId;
                    const isMemberSelf = member.user_id === currentUserId;

                    return (
                      <div
                        key={member.id}
                        className="p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt={member.full_name} className="w-full h-full object-cover" />
                            ) : (
                              member.full_name.substring(0, 2)
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs truncate">{member.full_name}</span>
                              {isMemberAdmin && (
                                <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-black text-white dark:bg-white dark:text-black uppercase">
                                  Admin
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400">
                              Membro desde {new Date(member.joined_at).toLocaleDateString("pt-PT")}
                            </span>
                          </div>
                        </div>

                        {!isMemberAdmin && !isMemberSelf && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.user_id, member.full_name)}
                            className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title="Remover membro da comunidade"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Tópico no Fórum */}
      {showForumModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-black dark:text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">Novo Tópico no Fórum</h3>
              <button
                onClick={() => setShowForumModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateForumTopic} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Capítulo ou Referência (Opcional)
                </label>
                <input
                  type="text"
                  value={chapterRef}
                  onChange={(e) => setChapterRef(e.target.value)}
                  placeholder="Ex: Capítulo 3, Páginas 40-55"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Título do Tópico *
                </label>
                <input
                  type="text"
                  value={forumTitle}
                  onChange={(e) => setForumTitle(e.target.value)}
                  placeholder="Ex: Análise da personagem principal"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Conteúdo / Reflexão *
                </label>
                <textarea
                  rows={4}
                  value={forumContent}
                  onChange={(e) => setForumContent(e.target.value)}
                  placeholder="Escreve a tua reflexão ou pergunta para o grupo debater..."
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowForumModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sending || !forumTitle.trim() || !forumContent.trim()}
                  className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {sending ? "A publicar..." : "Publicar Tópico"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Restrições para Convidados */}
      <GuestRestrictionModal
        isOpen={showGuestModal}
        feature="community"
        onClose={() => setShowGuestModal(false)}
      />

    </div>
  );
}
