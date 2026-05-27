// Shared ESLint flat-config base. Apps/packages layer their own overrides on top.
export default [
  {
    ignores: ["**/dist/**", "**/build/**", "**/node_modules/**"],
  },
];
