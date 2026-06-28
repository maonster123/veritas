import SplineBackground from "@/components/SplineBackground";
import LandingContent from "@/components/LandingContent";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black">
      <SplineBackground />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-transparent via-transparent to-black/60 pointer-events-none" />
      <LandingContent />
    </div>
  );
}
