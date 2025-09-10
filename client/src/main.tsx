import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("🚀 React main.tsx loading...");

const rootElement = document.getElementById("root");
console.log("📍 Root element found:", !!rootElement);

if (rootElement) {
  console.log("🎯 Creating React root and rendering...");
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("✅ React app rendered successfully");
} else {
  console.error("❌ Root element not found!");
}
