"use client";

import { MainMenu } from "@/src/components/MainMenu";
import { AIAvatarMachine } from "@/src/components/AIAvatarMachine";
import { VideoLibrary } from "@/src/components/VideoLibrary";

export default function Home() {
  return (
    <main className="min-h-screen">
      <MainMenu />
      {/* 
        NOTE: This is a reconstructed stub. The original page.tsx contained 
        the full AI Avatar Machine application logic including:
        - Video generation interface
        - Avatar creation and customization
        - Scene management for multi-scene videos
        - HeyGen API integration
        - Credit system UI
        - Video library access
        
        To restore the original code, copy from Vercel Web Editor at:
        https://vercel.com/adlenbenmechta2-9356s-projects/my-project/code
      */}
      <AIAvatarMachine />
      <VideoLibrary />
    </main>
  );
}
