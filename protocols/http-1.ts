import { createServer } from "net";
import type { Socket } from "net";

import { soInit, soRead, soWrite } from "../echo-server/promisify-socket";
import type {
  BodyReader,
  DynamicBuffer,
  HTTPReq,
  HTTPRes,
  TCPConn,
} from "../types";
import {
  bufPop,
  bufPush,
  encodeHTTPResp,
  fieldGet,
  parseDec,
  parseRequestLine,
  splitLines,
} from "./utils";

const MAX_HEADER_LEN = 1024 * 8;

async function serverClient(conn: TCPConn): Promise<void> {
  const buff: DynamicBuffer = { data: Buffer.alloc(0), len: 0 };

  while (true) {
    const msg = cutMessage(buff);

    if (!msg) {
      const data = await soRead(conn);
      bufPush(buff, data);

      if (data.length === 0 && buff.len === 0) {
        // EOF
        return;
      }

      if (data.length === 0) {
        throw new HttpError("400");
      }

      continue;
    }

    // parsing the msg
    const bodyReader = readerFromReq(conn, buff, msg);
    const res = await handleReq(msg, bodyReader);

    // send res
    await writeHttpRes(conn, res);

    // close conn if msg version 1.0
    if (msg.version === "1.0") {
      return;
    }

    // make sure that the request body is consumed completely
    while ((await bodyReader.read()).length > 0) {
      /* empty */
    }
  }
}

function parseHttpReq(buff: Buffer): HTTPReq {
  // split data into lines
  const lines = splitLines(buff);

  const [method, uri, version] = parseRequestLine(lines[0]); // first line has these as per spec

  // get headers
  const headers: Buffer[] = [];
  for (let i = 1; i < lines.length - 1; i++) {
    const h = Buffer.from(lines[i]); // copy
    // if (!validateHeader(h)) {
    //   throw new HttpError("400", "bad field");
    // }
    headers.push(h);
  }
  // the header ends by an empty line
  console.assert(lines[lines.length - 1].length === 0);
  return {
    method: method,
    uri: Buffer.from(uri),
    version: version,
    headers: headers,
  };
}

function readerFromReq(
  conn: TCPConn,
  buff: DynamicBuffer,
  req: HTTPReq
): BodyReader {
  let bodyLen = -1;
  const contentLen = fieldGet(req.headers, "Content-Length");
  if (contentLen) {
    bodyLen = parseDec(contentLen.toString("utf-8"));
    if (isNaN(bodyLen)) {
      throw new HttpError("400", "bad Content-Length.");
    }
  }
  const bodyAllowed = !(req.method === "GET" || req.method === "HEAD");
  const chunked =
    fieldGet(req.headers, "Transfer-Encoding")?.equals(
      Buffer.from("chunked")
    ) || false;
  if (!bodyAllowed && (bodyLen > 0 || chunked)) {
    throw new HttpError("400", "HTTP body not allowed.");
  }
  if (!bodyAllowed) {
    bodyLen = 0;
  }

  if (bodyLen >= 0) {
    // "Content-Length" is present
    return readerFromConnLength(conn, buff, bodyLen);
  } else if (chunked) {
    // chunked encoding
    // TODO
    throw new HttpError("503", "Todo");
  } else {
    // read the rest of the connection
    // TODO
    throw new HttpError("503", "Todo");
  }
}

// BodyReader from a socket with a known length
function readerFromConnLength(
  conn: TCPConn,
  buff: DynamicBuffer,
  remain: number
): BodyReader {
  return {
    length: remain,
    read: async (): Promise<Buffer> => {
      if (remain === 0) {
        return Buffer.from(""); // done
      }
      if (buff.len === 0) {
        // try to get some data if there is none
        const data = await soRead(conn);
        bufPush(buff, data);
        if (data.length === 0) {
          // expect more data!
          throw new Error("Unexpected EOF from HTTP body");
        }
      }
      // consume data from the buffer
      const consume = Math.min(buff.len, remain);
      remain -= consume;
      const data = Buffer.from(buff.data.subarray(0, consume));
      bufPop(buff, consume);
      return data;
    },
  };
}

function readerFromMemory(data: Buffer): BodyReader {
  let done = false;
  return {
    length: data.length,
    read: async (): Promise<Buffer> => {
      if (done) {
        return Buffer.from(""); // no more data
      } else {
        done = true;
        return data;
      }
    },
  };
}

async function handleReq(req: HTTPReq, body: BodyReader): Promise<HTTPRes> {
  // act on the request URI
  let resp: BodyReader;
  switch (req.uri.toString("utf-8")) {
    case "/echo":
      // http echo server
      resp = body;
      break;
    case "/lolyou":
      resp = readerFromMemory(Buffer.from("you have been hacked!"));
      break;

    default:
      resp = readerFromMemory(Buffer.from("hello world.\n"));
      break;
  }
  
  
  return {
    code: 200,
    headers: [],
    body: resp,
  };
}

function cutMessage(buff: DynamicBuffer): HTTPReq | null {
  const idx = buff.data.subarray(0, buff.len).indexOf("\r\n\r\n");
  if (idx < 0) {
    if (buff.len >= MAX_HEADER_LEN) {
      throw new HttpError("413", "header is too large");
    }

    return null; // need to get more data
  }
  const crlfLen = 4; // \r\n\r\n is 4 byte len

  if (idx + crlfLen > MAX_HEADER_LEN) {
    throw new HttpError("413", "header is too large");
  }

  const msg = parseHttpReq(buff.data.subarray(0, idx + crlfLen));

  bufPop(buff, idx + crlfLen);

  return msg;
}

async function writeHttpRes(conn: TCPConn, res: HTTPRes): Promise<void> {
  if (res.body.length < 0) {
    throw new Error("TODO: chunked encoding");
  }
  // set the "Content-Length" field
  console.assert(!fieldGet(res.headers, "Content-Length"));
  res.headers.push(Buffer.from(`Content-Length: ${res.body.length}`));
  // write the header
  await soWrite(conn, encodeHTTPResp(res)); // TODO - encode header properly into byte buffer
  // write the body
  while (true) {
    const data = await res.body.read();
    if (data.length === 0) {
      break;
    }
    await soWrite(conn, data);
  }
}

async function newConn(socket: Socket): Promise<void> {
  const conn = soInit(socket);

  try {
    await serverClient(conn);
  } catch (err) {
    console.error(err);
    if (err instanceof HttpError) {
      const res: HTTPRes = {
        code: parseInt(err.code, 10),
        headers: [],
        body: readerFromMemory(Buffer.from(err.message + "\n")),
      };

      try {
        await writeHttpRes(conn, res);
      } catch (err) {
        //
      }
    }
  } finally {
    socket.destroy();
  }
}

let server = createServer();
server.on("error", (err: Error) => {
  throw err;
});

server.on("connection", newConn);

server.listen(0, () => {
  console.log("Listening on", server.address());
});

class HttpError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? "");
    this.code = code;
  }
}
