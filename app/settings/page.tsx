import type { Metadata } from "next";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = {
  title: "Настройки — Leon",
};

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Настройки</h1>
      <SettingsForm />
    </div>
  );
}
