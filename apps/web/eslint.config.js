import react from "@leon/eslint-config/react";

export default [
  ...react,
  {
    files: ["app/routes/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": [
        "error",
        {
          allowExportNames: [
            "meta",
            "links",
            "headers",
            "loader",
            "clientLoader",
            "action",
            "clientAction",
            "ErrorBoundary",
            "HydrateFallback",
            "handle",
            "shouldRevalidate",
          ],
        },
      ],
    },
  },
];
