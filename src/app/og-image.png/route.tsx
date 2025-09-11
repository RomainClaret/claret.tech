import { ImageResponse } from "next/og";
import { logError } from "@/lib/utils/dev-logger";

export const runtime = "edge";

export async function GET() {
  try {
    return new ImageResponse(
      (
        <div
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px",
          }}
        >
          {/* Background pattern */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          {/* Content container */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              borderRadius: "24px",
              padding: "60px",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
              position: "relative",
              maxWidth: "1000px",
            }}
          >
            {/* Name */}
            <h1
              style={{
                fontSize: "72px",
                fontWeight: "bold",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                backgroundClip: "text",
                color: "transparent",
                marginBottom: "16px",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Romain Claret
            </h1>

            {/* Title */}
            <p
              style={{
                fontSize: "36px",
                color: "#4a5568",
                marginBottom: "32px",
                fontFamily: "Inter, sans-serif",
              }}
            >
              PhD Researcher & AI Engineer
            </p>

            {/* Divider */}
            <div
              style={{
                width: "100px",
                height: "4px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderRadius: "2px",
                marginBottom: "32px",
              }}
            />

            {/* Skills */}
            <div
              style={{
                display: "flex",
                gap: "16px",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {[
                "Neuroevolution",
                "Machine Learning",
                "Full-Stack Dev",
                "Research",
              ].map((skill) => (
                <div
                  key={skill}
                  style={{
                    backgroundColor: "#f7fafc",
                    border: "2px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "12px 24px",
                    fontSize: "20px",
                    color: "#2d3748",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {skill}
                </div>
              ))}
            </div>

            {/* URL */}
            <p
              style={{
                position: "absolute",
                bottom: "20px",
                right: "40px",
                fontSize: "20px",
                color: "#718096",
                fontFamily: "Inter, sans-serif",
              }}
            >
              claret.tech
            </p>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (e: unknown) {
    logError(e, "og-image-route-generation");
    return new Response(`Failed to generate image`, {
      status: 500,
    });
  }
}
