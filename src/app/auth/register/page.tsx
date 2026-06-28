import SplineBackground from "@/components/SplineBackground";
import RegisterForm from "./RegisterForm";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black">
      <SplineBackground />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-transparent to-black/50 pointer-events-none" />
      <RegisterForm />
    </div>
  );
}
