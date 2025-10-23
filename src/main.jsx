import React from "react";
import ReactDOM from "react-dom/client";
import RoutesRoot from "./RoutesRoot.jsx";
import AuthGate from "@/components/AuthGate";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate>
      <RoutesRoot />
    </AuthGate>
  </React.StrictMode>
);
