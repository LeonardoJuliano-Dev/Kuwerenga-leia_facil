import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Onboarding from "./pages/Onboarding";
import Login from "./pages/Login";
import SetupProfile from "./pages/SetupProfile";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Library from "./pages/Library";
import Profile from "./pages/Profile";
import Reader from "./pages/Reader";
import DonateBook from "./pages/DonateBook";
import BookDetails from "./pages/BookDetails";

function AuthRouter() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checkingAuth, setCheckingAuth] = useState(true);

  const checkUserStatus = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();

      if (!profile?.full_name || profile.full_name.trim().length === 0) {
        if (location.pathname !== "/setup-profile") {
          navigate("/setup-profile", { replace: true });
        }
      } else {
        // User is logged in and has completed profile
        if (location.pathname === "/" || location.pathname === "/login" || location.pathname === "/setup-profile") {
          navigate("/home", { replace: true });
        }
      }
    } catch (e) {
      console.error("Erro ao verificar perfil:", e);
      if (location.pathname === "/" || location.pathname === "/login") {
        navigate("/home", { replace: true });
      }
    }
  };

  useEffect(() => {
    // 1. Check existing session in localStorage
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        checkUserStatus(session.user.id).finally(() => setCheckingAuth(false));
      } else {
        // If not logged in and trying to access protected routes
        const publicRoutes = ["/", "/login"];
        if (!publicRoutes.includes(location.pathname)) {
          navigate("/", { replace: true });
        }
        setCheckingAuth(false);
      }
    });

    // 2. Listen for auth changes (Magic Link click, OTP verify, Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) {
        await checkUserStatus(session.user.id);
      } else if (event === "SIGNED_OUT") {
        navigate("/", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/setup-profile" element={<SetupProfile />} />
      <Route path="/home" element={<Home />} />
      <Route path="/explore" element={<Explore />} />
      <Route path="/library" element={<Library />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/reader" element={<Reader />} />
      <Route path="/donate-book" element={<DonateBook />} />
      <Route path="/book/:id" element={<BookDetails />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthRouter />
    </BrowserRouter>
  );
}

export default App;
