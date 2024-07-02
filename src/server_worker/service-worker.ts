let credentials: { username: string, password: string } | null = null;

self.addEventListener('message', (event: MessageEvent) => {
  if (event.data.type === 'SET_CREDENTIALS') {
    credentials = {
      username: event.data.username,
      password: event.data.password
    };
  }
});

self.addEventListener('fetch', (event: any) => {
  console.log("worder featch fired!!");
  const url = new URL(event.request.url);

  if (url.pathname.includes("protected") && credentials) {
    event.respondWith(
      (async function() {
        const token = btoa(`${credentials!.username}:${credentials!.password}`);
        const newHeaders = new Headers(event.request.headers);
        newHeaders.set('Authorization', `Basic ${token}`);

        const authRequest = new Request(event.request, {
          headers: newHeaders
        });

        return fetch(authRequest);
      })()
    );
  } else {
    event.respondWith(fetch(event.request));
  }
});
