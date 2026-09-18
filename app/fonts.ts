import localFont from "next/font/local";

export const rupaSansApp = localFont({
  display: "swap",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
  src: [
    {
      path: "./fonts/RupaSansApp-ExtraLight.otf",
      style: "normal",
      weight: "200",
    },
    {
      path: "./fonts/RupaSansApp-ExtraLightItalic.otf",
      style: "italic",
      weight: "200",
    },
    {
      path: "./fonts/RupaSansApp-Light.otf",
      style: "normal",
      weight: "300",
    },
    {
      path: "./fonts/RupaSansApp-LightItalic.otf",
      style: "italic",
      weight: "300",
    },
    {
      path: "./fonts/RupaSansApp-Regular.otf",
      style: "normal",
      weight: "400",
    },
    {
      path: "./fonts/RupaSansApp-Italic.otf",
      style: "italic",
      weight: "400",
    },
    {
      path: "./fonts/RupaSansApp-Medium.otf",
      style: "normal",
      weight: "500",
    },
    {
      path: "./fonts/RupaSansApp-MediumItalic.otf",
      style: "italic",
      weight: "500",
    },
    {
      path: "./fonts/RupaSansApp-SemiBold.otf",
      style: "normal",
      weight: "600",
    },
    {
      path: "./fonts/RupaSansApp-SemiBoldItalic.otf",
      style: "italic",
      weight: "600",
    },
    {
      path: "./fonts/RupaSansApp-Bold.otf",
      style: "normal",
      weight: "700",
    },
    {
      path: "./fonts/RupaSansApp-BoldItalic.otf",
      style: "italic",
      weight: "700",
    },
    {
      path: "./fonts/RupaSansApp-ExtraBold.otf",
      style: "normal",
      weight: "800",
    },
    {
      path: "./fonts/RupaSansApp-ExtraBoldItalic.otf",
      style: "italic",
      weight: "800",
    },
  ],
  variable: "--font-nexus-sans",
});
