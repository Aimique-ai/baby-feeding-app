import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import base from "./base.js";

export default [
  ...base,
  {
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
];
