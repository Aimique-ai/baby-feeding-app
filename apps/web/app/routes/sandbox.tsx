import { Button } from "~/components/ui/button";

export function meta() {
  return [{ title: "Sandbox — Leon" }];
}

export default function SandboxPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Button>shadcn ok</Button>
    </main>
  );
}
