import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as echarts from "echarts";
import AppRoot from "./app-root.js";
import "./styles/globals.css";

// Register ECharts dark theme globally
echarts.registerTheme("dark", {
  backgroundColor: "transparent",
  textStyle: {
    color: "oklch(0.895 0.013 285)",
  },
  color: [
    "oklch(0.623 0.214 259)",
    "oklch(0.696 0.17 162)",
    "oklch(0.795 0.184 86)",
    "oklch(0.637 0.237 25)",
    "oklch(0.551 0.027 264)",
  ],
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
