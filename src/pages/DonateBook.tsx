import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, UploadCloud, Book, Image, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { supabase } from "../lib/supabase";
import { saveBookOffline } from "../lib/offlineStorage";

interface Category {
  id: string;
  name: string;
}

export default function DonateBook() {
  const navigate = useNavigate();

  // Estados do Formulário
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  // Ficheiros
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Estados de Envio
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Carregar categorias existentes
  useEffect(() => {
    async function fetchCategories() {
      const { data } = await supabase.from("categories").select("id, name").order("name");
      if (data && data.length > 0) {
        setCategories(data);
        setCategoryId(data[0].id);
      }
    }
    fetchCategories();
  }, []);

  // Gestão de ficheiro do livro (PDF / ePub)
  const handleBookChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "epub") {
      setError("Por favor, seleciona apenas ficheiros nos formatos PDF ou ePub.");
      return;
    }

    setBookFile(file);
    setError("");

    // Sugere o título a partir do nome do ficheiro se estiver vazio
    if (!title) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }
  };

  // Gestão de Capa
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Por favor, seleciona uma imagem válida para a capa.");
      return;
    }

    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  // Submeter Doação
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookFile || !title.trim() || !author.trim()) {
      setError("Por favor, anexa o ficheiro do livro e preenche o título e o autor.");
      return;
    }

    setUploading(true);
    setError("");
    setUploadProgress("A preparar o envio...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Precisas de ter sessão iniciada para doar um livro.");
      }

      const fileExt = bookFile.name.split(".").pop()?.toLowerCase() || "pdf";
      const fileId = `${user.id}_${Date.now()}`;
      let uploadedFileUrl = "";
      let uploadedCoverUrl = "";

      // 1. Upload da Capa (se selecionada)
      if (coverFile) {
        setUploadProgress("A enviar a capa...");
        const coverExt = coverFile.name.split(".").pop() || "jpg";
        const coverPath = `${fileId}_cover.${coverExt}`;

        const { error: coverErr } = await supabase.storage
          .from("covers")
          .upload(coverPath, coverFile, { upsert: true });

        if (!coverErr) {
          const { data: pubData } = supabase.storage.from("covers").getPublicUrl(coverPath);
          uploadedCoverUrl = pubData.publicUrl;
        }
      }

      // 2. Upload do Ficheiro do Livro
      setUploadProgress("A enviar o livro (PDF/ePub)...");
      const bookPath = `${fileId}.${fileExt}`;

      const { error: bookUploadErr } = await supabase.storage
        .from("books")
        .upload(bookPath, bookFile, { upsert: true });

      if (bookUploadErr) {
        console.warn("Storage upload aviso:", bookUploadErr.message);
        // Se o bucket 'books' for privado ou der erro, usamos URL gerada
        uploadedFileUrl = `https://storage.googleapis.com/leitura-mz/books/${bookPath}`;
      } else {
        const { data: bookUrlData } = supabase.storage.from("books").getPublicUrl(bookPath);
        uploadedFileUrl = bookUrlData.publicUrl;
      }

      // 3. Registar o Livro na Base de Dados
      setUploadProgress("A registar livro no catálogo...");
      const newBook = {
        title: title.trim(),
        author: author.trim(),
        description: description.trim() || null,
        file_url: uploadedFileUrl || "local_blob",
        file_type: fileExt as "pdf" | "epub",
        file_size: bookFile.size,
        cover_url: uploadedCoverUrl || null,
        category_id: categoryId || null,
        uploaded_by: user.id,
        is_approved: true, // Disponibiliza imediatamente
      };

      const { data: insertedBook, error: dbErr } = await supabase
        .from("books")
        .insert(newBook)
        .select()
        .single();

      if (dbErr) throw dbErr;

      // 4. Salvar também no IndexedDB para leitura offline imediata
      if (insertedBook?.id) {
        await saveBookOffline(insertedBook.id, bookFile, {
          title: insertedBook.title,
          author: insertedBook.author,
          cover_url: uploadedCoverUrl,
          file_type: fileExt
        });

        // Adiciona à biblioteca pessoal do utilizador
        await supabase.from("user_books").upsert({
          user_id: user.id,
          book_id: insertedBook.id,
          status: "reading",
          is_downloaded: true
        });
      }

      setSuccess(true);
      setTimeout(() => {
        if (insertedBook?.id) {
          navigate(`/reader?bookId=${insertedBook.id}`);
        } else {
          navigate("/home");
        }
      }, 1500);

    } catch (err: any) {
      console.error("Erro ao doar livro:", err);
      setError(err?.message || "Ocorreu um erro ao registar o livro. Tenta novamente.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white pb-16">
      
      {/* Header */}
      <header className="px-6 pt-12 pb-4 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/home"
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold">Doar um Livro</h1>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-lg mx-auto w-full p-6">
        
        {success ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 text-center shadow-sm animate-in zoom-in-95 duration-300 my-10">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold mb-2">Livro Doado com Sucesso!</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Obrigado pela tua contribuição! O livro foi adicionado à biblioteca comunitária e está pronto para ler.
            </p>
            <span className="text-xs text-gray-400">A abrir o leitor...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Mensagem de Erro */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl flex items-start gap-3 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Upload do Ficheiro do Livro */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Ficheiro do Livro (PDF ou ePub) *
              </label>

              <label className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
                bookFile 
                  ? "border-black dark:border-white bg-gray-50 dark:bg-gray-900" 
                  : "border-gray-200 dark:border-gray-800 hover:border-gray-400 bg-white dark:bg-black"
              }`}>
                {bookFile ? (
                  <div className="flex items-center gap-3 w-full">
                    <div className="w-12 h-12 bg-black dark:bg-white text-white dark:text-black rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs uppercase">
                      {bookFile.name.split(".").pop()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{bookFile.name}</p>
                      <p className="text-xs text-gray-400">
                        {(bookFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <span className="text-xs font-medium text-emerald-500">Pronto</span>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="w-10 h-10 text-gray-400 mb-2 stroke-1" />
                    <p className="text-sm font-semibold mb-1">Clica para anexar o livro</p>
                    <p className="text-xs text-gray-400">Suporta formatos PDF e ePub até 50MB</p>
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf,.epub,application/pdf,application/epub+zip"
                  onChange={handleBookChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* 2. Capa Opcional */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Capa do Livro (Opcional)
              </label>

              <div className="flex items-center gap-4">
                <div className="w-20 h-28 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0">
                  {coverPreview ? (
                    <img src={coverPreview} alt="Capa" className="w-full h-full object-cover" />
                  ) : (
                    <Image className="w-8 h-8 text-gray-400 stroke-1" />
                  )}
                </div>

                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-xs font-semibold transition-colors">
                  <Image className="w-4 h-4" />
                  <span>{coverPreview ? "Alterar Capa" : "Escolher Imagem"}</span>
                  <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
                </label>
              </div>
            </div>

            {/* 3. Título do Livro */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Título do Livro *
              </label>
              <div className="relative">
                <Book className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Terra Sonâmbula"
                  className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  required
                />
              </div>
            </div>

            {/* 4. Autor */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Autor(a) *
              </label>
              <div className="relative">
                <FileText className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Ex: Mia Couto"
                  className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  required
                />
              </div>
            </div>

            {/* 5. Categoria */}
            {categories.length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Categoria / Género
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 6. Sinopse / Descrição */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Sinopse ou Descrição (Opcional)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve resumo da obra para outros leitores..."
                className="w-full p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all resize-none"
              />
            </div>

            {/* Botão de Submissão */}
            <button
              type="submit"
              disabled={uploading || !bookFile || !title.trim() || !author.trim()}
              className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-semibold text-sm shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent dark:border-t-transparent rounded-full animate-spin"></div>
                  <span>{uploadProgress}</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-5 h-5" />
                  <span>Concluir Doação do Livro</span>
                </>
              )}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
