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
  UserPlus
} from "lucide-react";
import { supabase } from "../lib/supabase";

interface Club {
  id: string;
  name: string;
  description: string | null;
  current_goal: string | null;
  member_count: number;
}

interface MessageItem {
  id: string;
  user_id: string;
  user_name: string;
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
  const [isMember, setIsMember] = useState(true);
  const [joining, setJoining] = useState(false);

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

  // 1. Carregar Dados do Clube e Mensagens
  useEffect(() => {
    if (!clubId) return;

    let isMounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) {
          setCurrentUserId(user.id);
          const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
          if (prof?.full_name) setCurrentUserName(prof.full_name);
        }

        let effectiveId = clubId;
        const isGeneral = clubId === "geral" || clubId === "general";

        if (isGeneral) {
          // Procurar clube geral ou existente
          const { data: gClubs } = await supabase
            .from("clubs")
            .select("id, name, description, current_goal, member_count")
            .ilike("name", "%geral%")
            .limit(1);

          if (gClubs && gClubs.length > 0) {
            effectiveId = gClubs[0].id;
            if (isMounted) setClub(gClubs[0]);
          } else {
            // Tenta pegar o primeiro clube existente
            const { data: anyClubs } = await supabase
              .from("clubs")
              .select("id, name, description, current_goal, member_count")
              .limit(1);

            if (anyClubs && anyClubs.length > 0) {
              effectiveId = anyClubs[0].id;
              if (isMounted) {
                setClub({
                  ...anyClubs[0],
                  name: "Chat Geral da Comunidade",
                  description: "Espaço aberto para todos os leitores trocarem ideias, imagens e notas de voz.",
                  current_goal: "Comunidade Aberta",
                });
              }
            } else {
              // Fallback default
              if (isMounted) {
                setClub({
                  id: "geral",
                  name: "Chat Geral da Comunidade",
                  description: "Espaço aberto para todos os leitores trocarem ideias, imagens e notas de voz.",
                  current_goal: "Comunidade Aberta",
                  member_count: 50,
                });
              }
            }
          }
        } else {
          // Clube específico por ID
          const { data: clubData } = await supabase
            .from("clubs")
            .select("id, name, description, current_goal, member_count")
            .eq("id", clubId)
            .single();

          if (clubData && isMounted) {
            setClub(clubData);
            effectiveId = clubData.id;
          }
        }

        if (isMounted) setActiveClubId(effectiveId || null);

        // Verificar membresia
        if (user && effectiveId && effectiveId !== "geral") {
          try {
            const { data: memberData } = await supabase
              .from("club_members")
              .select("role")
              .eq("club_id", effectiveId)
              .eq("user_id", user.id)
              .maybeSingle();

            if (isMounted) setIsMember(!!memberData);
          } catch {
            if (isMounted) setIsMember(true);
          }
        }

        // Carregar mensagens do clube
        if (effectiveId && effectiveId !== "geral") {
          const { data: discData, error } = await supabase
            .from("club_discussions")
            .select(`
              id,
              user_id,
              message,
              chapter_reference,
              created_at,
              profile:profiles(full_name)
            `)
            .eq("club_id", effectiveId)
            .order("created_at", { ascending: true });

          if (!error && discData && isMounted) {
            const parsedMessages: MessageItem[] = discData.map((d: any) => {
              let itemText = d.message;
              let mediaUrl: string | undefined = undefined;
              let mediaType: "image" | "audio" | undefined = undefined;
              let duration: number | undefined = undefined;

              // Tenta decodificar mensagem rica (JSON)
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

  // Realtime subscription para mensagens ao vivo
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
        (payload) => {
          const newRow: any = payload.new;
          if (!newRow) return;

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
              user_name: newRow.user_id === currentUserId ? currentUserName : "Leitor",
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeClubId, currentUserId, currentUserName]);

  // Scroll automático para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  // Aderir ao Clube
  const handleJoinClub = async () => {
    if (!currentUserId || !activeClubId || activeClubId === "geral") return;

    setJoining(true);
    try {
      await supabase.from("club_members").insert({
        club_id: activeClubId,
        user_id: currentUserId,
        role: "member",
      });
      setIsMember(true);
      if (club) setClub({ ...club, member_count: club.member_count + 1 });
    } catch (err) {
      console.error("Erro ao aderir:", err);
      setIsMember(true);
    } finally {
      setJoining(false);
    }
  };

  // 2. Gravador de Áudio com Limite Estrito de 30 Segundos
  const startRecording = async () => {
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

      // Contador de segundos com limite de 30s
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
      alert("Por favor, permite o acesso ao microfone no navegador para gravar áudios.");
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordSeconds(0);
  };

  // 3. Enviar Áudio (Data URL base64, max 30s)
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
          media_url: base64Audio,
          media_type: "audio",
          duration: cappedDuration,
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => {
          const updated = [...prev, newMsg];
          if (targetId) {
            try {
              localStorage.setItem(`club_msgs_${targetId}`, JSON.stringify(updated));
            } catch {}
          }
          return updated;
        });

        setSending(false);
      };
    } catch (err) {
      console.error("Erro ao enviar áudio:", err);
      setSending(false);
    }
  };

  // 4. Enviar Mensagem de Texto ou Imagem
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedImage) || !currentUserId) return;

    setSending(true);
    try {
      let mediaUrl: string | undefined = undefined;
      let mediaType: "image" | undefined = undefined;

      if (selectedImage) {
        mediaType = "image";
        mediaUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(selectedImage);
        });
      }

      let finalMessage = inputText.trim();

      if (mediaUrl) {
        finalMessage = JSON.stringify({
          text: inputText.trim(),
          media_url: mediaUrl,
          media_type: "image",
        });
      }

      const targetId = activeClubId && activeClubId !== "geral" ? activeClubId : null;
      let insertedId = "msg-" + Date.now();

      if (targetId) {
        const { data: inserted } = await supabase
          .from("club_discussions")
          .insert({
            club_id: targetId,
            user_id: currentUserId,
            message: finalMessage,
          })
          .select()
          .single();

        if (inserted) insertedId = inserted.id;
      }

      const newMsg: MessageItem = {
        id: insertedId,
        user_id: currentUserId,
        user_name: currentUserName,
        text: inputText.trim(),
        media_url: mediaUrl,
        media_type: mediaType,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => {
        const updated = [...prev, newMsg];
        if (targetId) {
          try {
            localStorage.setItem(`club_msgs_${targetId}`, JSON.stringify(updated));
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

  // 5. Publicar Tópico no Fórum do Clube
  const handleCreateForumTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forumTitle.trim() || !forumContent.trim() || !currentUserId) return;

    setSending(true);
    try {
      const topicMessage = `${forumTitle.trim()}\n\n${forumContent.trim()}`;
      const targetId = activeClubId && activeClubId !== "geral" ? activeClubId : null;
      let insertedId = "topic-" + Date.now();

      if (targetId) {
        const { data: inserted } = await supabase
          .from("club_discussions")
          .insert({
            club_id: targetId,
            user_id: currentUserId,
            message: topicMessage,
            chapter_reference: chapterRef.trim() || "Geral",
          })
          .select()
          .single();

        if (inserted) insertedId = inserted.id;
      }

      const newTopic: MessageItem = {
        id: insertedId,
        user_id: currentUserId,
        user_name: currentUserName,
        text: topicMessage,
        chapter_reference: chapterRef.trim() || "Geral",
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => {
        const updated = [...prev, newTopic];
        if (targetId) {
          try {
            localStorage.setItem(`club_msgs_${targetId}`, JSON.stringify(updated));
          } catch {}
        }
        return updated;
      });

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
        <h2 className="text-xl font-bold mb-2">Clube não encontrado</h2>
        <p className="text-sm text-gray-500 mb-6">O clube selecionado não existe ou foi removido.</p>
        <Link to="/community" className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold">
          Voltar à Comunidade
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-black text-black dark:text-white overflow-hidden">
      
      {/* Top Header */}
      <header className="px-4 sm:px-6 pt-safe bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900 flex-shrink-0 z-10">
        <div className="app-container pt-6 sm:pt-8 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/community")}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="max-w-[200px] sm:max-w-md truncate">
              <h1 className="font-bold text-base truncate">{club.name}</h1>
              <span className="text-[11px] text-gray-400 block truncate">
                {club.member_count} {club.member_count === 1 ? "membro" : "membros"} • {club.current_goal || "Debate aberto"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isMember && (
              <button
                onClick={handleJoinClub}
                disabled={joining}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-semibold active:scale-95 transition-transform shadow-xs disabled:opacity-50"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{joining ? "A aderir..." : "Aderir"}</span>
              </button>
            )}

            {activeTab === "forum" && (
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
            className={`px-4 py-1.5 rounded-xl font-semibold transition-all ${
              activeTab === "chat"
                ? "bg-black dark:bg-white text-white dark:text-black shadow-xs"
                : "bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-black dark:hover:text-white"
            }`}
          >
            Chat em Direto
          </button>
          <button
            onClick={() => setActiveTab("forum")}
            className={`px-4 py-1.5 rounded-xl font-semibold transition-all ${
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

      {/* ÁREA 1: CHAT ABERTO EM TEMPO REAL */}
      {activeTab === "chat" && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          
          {/* Lista de Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {chatMessages.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-xs max-w-xs mx-auto">
                Ainda não há mensagens no chat deste clube. Sê o primeiro a enviar uma mensagem de texto, foto ou gravação de voz!
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isMe = msg.user_id === currentUserId;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <span className="text-[10px] text-gray-400 mb-1 px-1">
                      {isMe ? "Tu" : msg.user_name}
                    </span>

                    <div
                      className={`max-w-[85%] sm:max-w-md p-3.5 rounded-2xl shadow-xs ${
                        isMe
                          ? "bg-black dark:bg-white text-white dark:text-black rounded-br-xs"
                          : "bg-white dark:bg-gray-900 text-black dark:text-white border border-gray-100 dark:border-gray-800 rounded-bl-xs"
                      }`}
                    >
                      {/* Imagem (se houver) */}
                      {msg.media_type === "image" && msg.media_url && (
                        <div className="rounded-xl overflow-hidden mb-2 max-h-60 bg-gray-100 dark:bg-gray-800">
                          <img
                            src={msg.media_url}
                            alt="Foto enviada"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* Áudio (se houver, até 30s) */}
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

                      <span className="text-[9px] opacity-60 block text-right mt-1.5">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Pré-visualização de imagem anexada */}
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
                className="p-1 rounded-full text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Barra de Envio (Texto, Microfone e Foto) */}
          <footer className="p-3 sm:p-4 bg-white dark:bg-black border-t border-gray-100 dark:border-gray-900 flex-shrink-0">
            {isRecording ? (
              <div className="flex items-center justify-between p-2 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-ping"></div>
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">
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
                    className="p-2 rounded-full bg-red-500 text-white shadow-xs"
                    title="Enviar áudio"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                </div>
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
                  placeholder="Escreve uma mensagem para o clube..."
                  className="flex-1 bg-gray-100 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-medium"
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
      )}

      {/* ÁREA 2: FÓRUM / DISCUSSÕES POR CAPÍTULO */}
      {activeTab === "forum" && (
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
                onClick={() => setShowForumModal(true)}
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

    </div>
  );
}
