import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
