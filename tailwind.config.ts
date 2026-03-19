import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 20px 50px -20px rgba(15, 23, 42, 0.22)",
        glow: "0 20px 60px -25px rgba(56, 189, 248, 0.35)"
      },
      backgroundImage: {
        "hero-gradient": "radial-gradient(circle at 10% 0%, rgba(14, 165, 233, 0.18), transparent 45%), radial-gradient(circle at 90% 10%, rgba(14, 116, 144, 0.12), transparent 35%), linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)"
      }
    }
  },
  plugins: []
} satisfies Config;
