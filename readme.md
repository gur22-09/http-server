# server-from-scratch

A simple HTTP server built entirely from scratch in TypeScript without relying on frameworks like Express or Fastify. This project focuses on understanding low-level networking concepts such as TCP sockets, parsing protocols, and building a functional HTTP/1.1 server.

## Overview

This repo contains multiple small server implementations that progressively build up to a full HTTP server:

* `echo-server/` — an echo server over raw TCP
* `protocols/newline-proto.ts` — a line-delimited protocol server
* `protocols/http-1.ts` — a basic HTTP/1.1 server implementation

## Scripts

Use the following npm scripts to start different servers:

```bash
npm run start:echo          # Starts the raw TCP echo server
npm run start:newline-proto # Starts a newline-delimited protocol server
npm run start:http          # Starts the HTTP server (http-1)
```

## Prerequisites

* Node.js >= 18
* TypeScript 5.x

Make sure you have `tsx` installed, which is already included in the dependencies.

## Example Usage

Start the HTTP server:

```bash
npm run start:http
```

Then in another terminal:

```bash
curl -s --data-binary 'hello' http://127.0.0.1:65177/echo
```

You should receive a raw HTTP response built completely by your own server code.



---

## Roadmap / Next Steps

* Add basic routing based on method + path
* Implement persistent connections (keep-alive)
* Support parsing request bodies (Content-Length and chunked encoding)
* Add minimal logging or middleware support

---


