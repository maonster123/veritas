import Spline from "@splinetool/react-spline/next";
import { Suspense } from "react";

export default function SplineBackground() {
  return (
    <div className="absolute inset-0 z-0 bg-black">
      <Suspense fallback={
        <div className="flex items-center justify-center w-full h-full">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      }>
        <Spline
          scene="https://prod.spline.design/168c9a63-d7eb-4417-a8a5-a8377f74bfdc/scene.splinecode"
          className="w-full h-full"
        />
      </Suspense>
    </div>
  );
}
