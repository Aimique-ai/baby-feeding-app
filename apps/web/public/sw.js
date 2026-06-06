// Leon service worker — push reminders only. Deliberately NO precache/fetch
// handler: this is not an offline PWA, and a fetch handler would interfere with
// React Router SSR navigation. Served as a static file at /sw.js (scope "/").

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = data.title || "Пора кормить";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    // tag per baby: reminders for different babies stack; a new reminder for
    // the SAME baby replaces the previous one.
    tag: data.babyId ? `feed-${data.babyId}` : "feed",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // Focus an existing window and navigate it to the target baby, rather
      // than spawning a duplicate tab.
      const client = wins.find((w) => "focus" in w);
      if (client) {
        if ("navigate" in client) client.navigate(url);
        return client.focus();
      }
      return clients.openWindow(url);
    }),
  );
});
