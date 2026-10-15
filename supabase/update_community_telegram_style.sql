-- ============================================================
-- KUWERENGA: Atualização de Comunidades Estilo Telegram
-- Suporte a Foto de Perfil (avatar_url) e Fundo (cover_url)
-- ============================================================
-- Executar no SQL Editor do Supabase se necessário

-- 1. Garantir que as colunas avatar_url e cover_url existem na tabela clubs
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS cover_url text;

-- 2. Garantir que quem cria a comunidade (e administradores do grupo) possa atualizar avatar_url, cover_url e detalhes
DROP POLICY IF EXISTS "Admins can update their clubs" ON public.clubs;
DROP POLICY IF EXISTS "Creators can update their clubs" ON public.clubs;

CREATE POLICY "Creators can update their clubs"
  ON public.clubs FOR UPDATE
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = clubs.id AND cm.user_id = auth.uid() AND cm.role = 'admin'
    )
  );
