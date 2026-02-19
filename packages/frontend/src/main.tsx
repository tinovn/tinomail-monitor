import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as echarts from "echarts";
import AppRoot from "./app-root.js";
import "./styles/globals.css";

// Register ECharts dark theme globally
echarts.registerTheme("dark", {
  backgroundColor: "transparent",
  textStyle: {
    color: "#dbdbe5",
  },
  color: [
    "#2580ff",
    "#00bc7c",
    "#f0b100",
    "#fb2c38",
    "#6a7282",
  ],
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
