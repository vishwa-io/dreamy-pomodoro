import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari, Noto_Naskh_Arabic, Gaegu } from "next/font/google";
import "./globals.css";
import "./dreamy.css";
import AudioProvider from "./audio-provider";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-inter",
});

const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400"],
  display: "swap",
  variable: "--font-devanagari",
});

const arabic = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400"],
  display: "swap",
  variable: "--font-arabic",
});

const hand = Gaegu({
  subsets: ["latin"],
  weight: "700",
  display: "swap",
  variable: "--font-hand",
});

export const metadata: Metadata = {
  title: "Dreamy Pomodoro",
  description: "A quiet Pomodoro timer by the swan pond.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0e0e0e",
};

const themeInit = `
(function(){
  try{
    var s = localStorage.getItem('theme');
    var m = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var t = (s === 'light' || s === 'dark') ? s : (m ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
  }catch(e){}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${devanagari.variable} ${arabic.variable} ${hand.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <AudioProvider>{children}</AudioProvider>
      </body>
    </html>
  );
}
