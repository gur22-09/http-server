import * as net from "net";
import type { TCPConn } from "../types";



// create a wrapper from net.Socket
export function soInit(socket: net.Socket): TCPConn {
  const conn: TCPConn = {
    socket: socket,
    reader: null,
    ended: false,
    error: null,
  };

  socket.on("data", (data: Buffer) => {
    console.assert(conn.reader);
    // pause the 'data' event until the next read.
    conn.socket.pause();
    // fulfill the promise of the current read.
    conn.reader!.resolve(data);
    conn.reader = null;
  });

  socket.on("end", () => {
    conn.ended = true;

    if (conn.reader) {
      // EOF
      conn.reader.resolve(Buffer.from(""));
      conn.reader = null;
    }
  });

  socket.on("error", (err) => {
    conn.error = err;

    if (conn.reader) {
      conn.reader.reject(err);
      conn.reader = null;
    }
  });

  return conn;
}

export function soRead(conn: TCPConn): Promise<Buffer> {
  console.assert(!conn.reader); // no concurrent calls
  return new Promise((resolve, reject) => {
    // if the connection is not readable, complete the promise now.
    if (conn.error) {
      reject(conn.error);
      return;
    }

    if (conn.ended) {
      resolve(Buffer.from("")); // EOF
      return;
    }

    // save the promise callbacks
    conn.reader = {
      resolve: resolve,
      reject: reject,
    };
    // and resume the 'data' event to fulfill the promise later.
    conn.socket.resume();
  });
}

export function soWrite(conn: TCPConn, data: Buffer): Promise<void> {
  console.assert(data.length > 0);
  return new Promise((resolve, reject) => {
    if (conn.error) {
      reject(conn.error);
      return;
    }
    
    
    conn.socket.write(data, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export async function newConn(socket: net.Socket): Promise<void> {
  console.log("new connection", socket.remoteAddress, socket.remotePort);
  try {
    await serveClient(socket);
  } catch (err) {
    console.error("exception:", err);
  } finally {
    socket.destroy();
  }
}

async function serveClient(socket: net.Socket): Promise<void> {
  const conn: TCPConn = soInit(socket);
  while (true) {
    const data = await soRead(conn);
    if (data.includes("quit") || data.length === 0) {
      console.log("end connection");
      break;
    }

    console.log("data from the user", data);
    await soWrite(conn, data);
  }
}

let server = net.createServer(); // creates a listening socket to bind and listen to address
server.on("error", (err: Error) => {
  throw err;
});


server.on("connection", newConn);

server.listen({ hostname: "127.0.0.1", port: 1234 });