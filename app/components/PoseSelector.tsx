"use client";

import { ALL_POSES } from "../lib/poses";
import type { PoseDefinition } from "../lib/poses";

interface Props {
  onSelect: (pose: PoseDefinition) => void;
}

export default function PoseSelector({ onSelect }: Props) {
  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        background: "#080808",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        fontFamily: "'Space Mono', 'Courier New', monospace",
        boxSizing: "border-box",
        gap: 48,
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: "4px",
            color: "#666",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          Entrenamiento de poses
        </div>
        <h1
          style={{
            fontSize: 42,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: 1,
            margin: 0,
          }}
        >
          Selecciona una pose
        </h1>
        <p style={{ color: "#444", fontSize: 16, marginTop: 12 }}>
          {ALL_POSES.length} ejercicios listos para comenzar
        </p>
      </div>

      {/* Grid de poses */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 24,
          width: "100%",
          maxWidth: 1000,
        }}
      >
        {ALL_POSES.map((pose) => (
          <button
            key={pose.id}
            onClick={() => onSelect(pose)}
            style={{
              background: "#111",
              border: "2px solid #222",
              borderRadius: 24,
              padding: "40px 32px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              fontFamily: "inherit",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              boxShadow: "0 10px 20px rgba(0,0,0,0.2)"
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.borderColor = "#00d26e";
              btn.style.background = "#161616";
              btn.style.transform = "translateY(-5px)";
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.borderColor = "#222";
              btn.style.background = "#111";
              btn.style.transform = "translateY(0)";
            }}
          >
            {/* Ícono dinámico: Lee de la definición de la pose */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: "rgba(0,210,110,0.1)",
                border: "2px solid rgba(0,210,110,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                color: "#00d26e",
                fontWeight: 700,
              }}
            >
              {pose.icon ?? "◈"}
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#fff",
                  marginBottom: 8,
                  letterSpacing: 0.5,
                }}
              >
                {pose.name}
              </div>
              <div style={{ fontSize: 15, color: "#888", lineHeight: 1.6 }}>
                {pose.description}
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 8,
                paddingTop: 20,
                borderTop: "1px solid #222"
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "#555",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  fontWeight: 600
                }}
              >
                {pose.keypoints.length} puntos de control
              </span>
              <span style={{ 
                color: "#00d26e", 
                fontSize: 24,
                fontWeight: "bold" 
              }}>→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}