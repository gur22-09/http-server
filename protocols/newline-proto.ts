import * as net from "net";
import { soInit, soRead, soWrite } from "../echo-server/promisify-socket";
import type { TCPConn } from "../types";


// the most imp work a protocol does is splitting byte stream into messages
// buffers are required to store the incoming data which we can then try to split message from

type DynamicBuffer = {
  data: Buffer;
  len: number;
};

function bufPush(buf: DynamicBuffer, data: Buffer): void {
  const newLen = buf.len + data.length;
  if (buf.data.length < newLen) {
    let cap = Math.max(buf.data.length, 32);
    while (cap < newLen) {
      cap *= 2;
    }
    const grown = Buffer.alloc(cap);
    buf.data.copy(grown, 0, 0, buf.len);
    buf.data = grown;
  }

  data.copy(buf.data, buf.len);
  buf.len = newLen;
}

async function serveClient(socket: net.Socket): Promise<void> {
  const conn: TCPConn = soInit(socket);
  const buf: DynamicBuffer = { data: Buffer.alloc(0), len: 0 };

  // network/server loop
  while (true) {
    const data = await soRead(conn);
    if (data.length === 0) continue;

    bufPush(buf, data);

    // message parsing loop for draining 
    while (true) {
      const msg = cutMessage(buf);
      if (!msg) break;

    //   console.log("Received:", msg.toString());

      if (msg.toString().trim() === "quit") {
        // console.log("server quit");
        await soWrite(conn, Buffer.from("Bye.\n"));
        socket.destroy();
        return;
      } else {
        const reply = Buffer.concat([Buffer.from("Echo: "), msg, Buffer.from("\n")]);
        await soWrite(conn, reply);
      }
    }
  }
}

/**
 * This will return null until a complete message is recieved
 */
function cutMessage(buf: DynamicBuffer): null | Buffer {
  // messages are separated by '\n'
//   console.log("buffer subarray", buf.data.subarray(0, buf.len));
  const idx = buf.data.subarray(0, buf.len).indexOf("\n");
  if (idx < 0) {
    return null; // not complete
  }
  
  // Extract message WITHOUT the newline character
  const msg = Buffer.from(buf.data.subarray(0, idx)); 
  
  // Remove the message from buffer
  bufPop(buf, idx + 1); 

 
  return msg;
}


function bufPop(buf: DynamicBuffer, len: number): void {
  buf.data.copyWithin(0, len, buf.len);
  buf.len -= len;
}

async function newConn(socket: net.Socket): Promise<void> {
  console.log("new connection", socket.remoteAddress, socket.remotePort);
  try {
    await serveClient(socket);
  } catch (err) {
    console.error("exception:", err);
  } finally {
    socket.destroy();
  }
}

let server = net.createServer();
server.on("error", (err: Error) => {
  throw err;
});

server.on("connection", newConn);

server.listen(0, () => {
  console.log("Listening on", server.address());
});

// try sending echo "hello there\n12345" | socat 127.0.0.1:${port} -
