import { useState, useRef, useEffect } from "react";
import {
  X,
  Camera,
  Image as ImageIcon,
  Check,
  Globe,
  Lock,
  Trash2,
  Users
} from "lucide-react";
import { getCommunityInitials, getCommunityColorPalette, uploadClubImage } from "../lib/communityStyle";
import { updateClubDetails } from "../lib/communityService";

export interface CommunityEditData {
  id: string;
  name: string;
  description: string | null;
  current_goal: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  is_public?: boolean;
}

interface EditCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  club: CommunityEditData;
  onSaved: (updatedClub: CommunityEditData) => void;
}

export default function EditCommunityModal({
  isOpen,
  onClose,
  club,
  onSaved,
}: EditCommunityModalProps) {
  const [name, setName] = useState(club.name || "");
  const [description, setDescription] = useState(club.description || "");
  const [currentGoal, setCurrentGoal] = useState(club.current_goal || "");
  const [isPublic, setIsPublic] = useState(club.is_public !== false);

  // Foto de Perfil (Avatar)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(club.avatar_url || null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Fundo do Grupo (Cover)
  const [coverPreview, setCoverPreview] = useState<string | null>(club.cover_url || null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(club.name || "");
      setDescription(club.description || "");
      setCurrentGoal(club.current_goal || "");
      setIsPublic(club.is_public !== false);
      setAvatarPreview(club.avatar_url || null);
      setAvatarFile(null);
      setCoverPreview(club.cover_url || null);
      setCoverFile(null);
      setError("");
    }
  }, [isOpen, club]);

  if (!isOpen) return null;

  const palette = getCommunityColorPalette(name || club.name);
  const initials = getCommunityInitials(name || club.name);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Por favor, seleciona um ficheiro de imagem válido para a foto de perfil.");
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError("");
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Por favor, seleciona um ficheiro de imagem válido para o fundo.");
      return;
    }

    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setError("");
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleRemoveCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("O nome da comunidade não pode estar em branco.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let finalAvatarUrl: string | null =
        avatarPreview && !avatarPreview.startsWith("blob:") ? avatarPreview : null;
      let finalCoverUrl: string | null =
        coverPreview && !coverPreview.startsWith("blob:") ? coverPreview : null;

      // 1. Upload da foto do perfil (se selecionada nova)
      if (avatarFile) {
        const uploadedAvatar = await uploadClubImage(club.id, avatarFile, "avatar");
        if (uploadedAvatar) {
          finalAvatarUrl = uploadedAvatar;
        } else {
          throw new Error("Não foi possível carregar a foto do perfil. Tenta outra imagem.");
        }
      }

      // 2. Upload da imagem de fundo (se selecionada nova)
      if (coverFile) {
        const uploadedCover = await uploadClubImage(club.id, coverFile, "cover");
        if (uploadedCover) {
          finalCoverUrl = uploadedCover;
        } else {
          throw new Error("Não foi possível carregar a imagem de fundo. Tenta outra imagem.");
        }
      }

      // 3. Atualizar dados no Supabase
      const success = await updateClubDetails(club.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        current_goal: currentGoal.trim() || undefined,
        avatar_url: finalAvatarUrl,
        cover_url: finalCoverUrl,
        is_public: isPublic,
      });

      if (!success) {
        throw new Error("Não foi possível atualizar os dados da comunidade.");
      }

      onSaved({
        id: club.id,
        name: name.trim(),
        description: description.trim() || null,
        current_goal: currentGoal.trim() || null,
        avatar_url: finalAvatarUrl,
        cover_url: finalCoverUrl,
        is_public: isPublic,
      });

      onClose();
    } catch (err: any) {
      console.error("Erro ao guardar alterações:", err);
      setError(err?.message || "Ocorreu um erro ao guardar as alterações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-black dark:text-white animate-in zoom-in-95 duration-200"
      >
        {/* Header do Modal */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-black dark:text-white" />
            <h2 className="font-bold text-base">Editar Comunidade</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário com Scroll */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-6">
          {error && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* ─── Pré-visualização Combinada: Fundo & Foto do Grupo (Estilo Telegram) ─── */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Aparência do Grupo (Foto e Fundo)
            </label>

            <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-xs">
              {/* Imagem de Fundo / Fundo Sólido Padrão */}
              <div
                className={`w-full h-32 relative flex items-center justify-end p-3 transition-colors ${
                  coverPreview ? "bg-black" : `bg-gradient-to-r ${palette.coverGradient}`
                }`}
              >
                {coverPreview ? (
                  <img
                    src={coverPreview}
                    alt="Fundo do Grupo"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center opacity-25">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-white">
                      Fundo Sólido Padrão
                    </span>
                  </div>
                )}

                {/* Botões para gerir o Fundo */}
                <div className="relative z-10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/70 hover:bg-black text-white backdrop-blur-md text-xs font-semibold shadow-xs transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>{coverPreview ? "Alterar Fundo" : "Adicionar Fundo"}</span>
                  </button>

                  {coverPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveCover}
                      className="p-1.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-white backdrop-blur-md shadow-xs transition-colors"
                      title="Voltar ao fundo sólido padrão"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverChange}
                  className="hidden"
                />
              </div>

              {/* Foto de Perfil do Grupo (Avatar Circular Sobreposto) */}
              <div className="px-4 pb-3.5 pt-0 bg-white dark:bg-gray-900 flex items-end justify-between -mt-9 relative z-10">
                <div className="flex items-end gap-3.5">
                  <div className="relative group">
                    <div
                      className={`w-18 h-18 rounded-full ring-4 ring-white dark:ring-gray-900 shadow-md overflow-hidden flex items-center justify-center ${
                        avatarPreview ? "bg-black" : `bg-gradient-to-tr ${palette.gradient}`
                      }`}
                    >
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="Foto do Grupo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl font-bold text-white tracking-wider">
                          {initials}
                        </span>
                      )}
                    </div>

                    {/* Botão de Trocar Foto sobre o Avatar */}
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                      title="Alterar foto do grupo"
                    >
                      <Camera className="w-5 h-5" />
                    </button>

                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </div>

                  <div className="pb-1">
                    <h3 className="font-bold text-sm leading-tight truncate max-w-[200px]">
                      {name || "Nome do Grupo"}
                    </h3>
                    <span className="text-[11px] text-gray-500 block">
                      {avatarPreview ? "Foto personalizada" : "Foto sólida padrão"}
                    </span>
                  </div>
                </div>

                {/* Botões de Ação para o Avatar */}
                <div className="flex items-center gap-1.5 pb-1">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Foto do Grupo
                  </button>

                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      title="Remover foto (usar padrão sólido)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Nome da Comunidade */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Nome da Comunidade *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Clube de Ficção Científica"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
              required
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Descrição do Grupo
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreve o propósito do grupo, géneros debatidos e regras básicas..."
              className="w-full p-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all resize-none"
            />
          </div>

          {/* Meta / Objetivo Atual */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Objetivo ou Livro Atual
            </label>
            <input
              type="text"
              value={currentGoal}
              onChange={(e) => setCurrentGoal(e.target.value)}
              placeholder="Ex: Leitura coletiva de 'Duna' até ao fim do mês"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
            />
          </div>

          {/* Privacidade da Comunidade */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Tipo de Comunidade
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                  isPublic
                    ? "border-black dark:border-white bg-black/5 dark:bg-white/10"
                    : "border-gray-200 dark:border-gray-800 hover:border-gray-300"
                }`}
              >
                <Globe className="w-5 h-5 text-black dark:text-white shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs">Pública</span>
                    {isPublic && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                  <span className="text-[11px] text-gray-500 block leading-tight mt-0.5">
                    Qualquer leitor pode entrar livremente
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                  !isPublic
                    ? "border-black dark:border-white bg-black/5 dark:bg-white/10"
                    : "border-gray-200 dark:border-gray-800 hover:border-gray-300"
                }`}
              >
                <Lock className="w-5 h-5 text-black dark:text-white shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs">Privada</span>
                    {!isPublic && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                  <span className="text-[11px] text-gray-500 block leading-tight mt-0.5">
                    Requer aprovação do admin para entrar
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Botões do Rodapé */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-6 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold shadow-md active:scale-95 transition-transform flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                  <span>A guardar...</span>
                </>
              ) : (
                <span>Guardar Alterações</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
