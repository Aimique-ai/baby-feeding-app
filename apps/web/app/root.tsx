import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { AppearanceProvider } from "~/providers/AppearanceProvider";
import { QueryProvider } from "~/providers/QueryProvider";
import "./globals.css";

const PREPAINT_SCRIPT = `(function(){
  try {
    var t = localStorage.getItem('leon-theme');
    var resolved = t === 'light' || t === 'dark'
      ? t
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (e) {}
  try {
    var p = localStorage.getItem('leon-palette');
    var allowed = ['neutral','blue','green','rose','amber'];
    if (!p || allowed.indexOf(p) === -1) p = 'neutral';
    document.documentElement.setAttribute('data-palette', p);
  } catch (e) {}
})();`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className="h-full antialiased">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: PREPAINT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <AppearanceProvider>
      <QueryProvider>
        <Outlet />
      </QueryProvider>
    </AppearanceProvider>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let message = "Unknown error";
  let detail: string | null = null;
  if (isRouteErrorResponse(error)) {
    message = `${error.status} ${error.statusText}`;
    detail = typeof error.data === "string" ? error.data : null;
  } else if (error instanceof Error) {
    message = error.message;
    detail = error.stack ?? null;
  }
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">{message}</h1>
      {detail ? (
        <pre className="mt-4 overflow-auto rounded bg-muted p-3 text-xs">
          {detail}
        </pre>
      ) : null}
    </main>
  );
}
