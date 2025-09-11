import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Force light mode to prevent white-on-white text
document.documentElement.classList.remove('dark');
document.body.classList.remove('dark');

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
