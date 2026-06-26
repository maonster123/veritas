import SplineBackground from "@/components/SplineBackground";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black">
      <SplineBackground />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-transparent to-black/50 pointer-events-none" />
      <LoginForm />
    </div>
  );
}
