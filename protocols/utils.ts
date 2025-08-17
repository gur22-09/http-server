import type { DynamicBuffer, HTTPRes } from "../types";

export function bufPop(buf: DynamicBuffer, len: number): void {
  buf.data.copyWithin(0, len, buf.len);
  buf.len -= len;
}

export function bufPush(buf: DynamicBuffer, data: Buffer): void {
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

export function splitLines(buffer: Buffer): string[] {
  const str = buffer.toString("utf-8");

  return str.split("\r\n");
}

export function parseRequestLine(line: string): [string, string, string] {
  //   const trimmed = line.trim();
  const parts = line.split(" ");

  if (parts.length !== 3) {
    throw new Error("Malformed request line");
  }

  return [parts[0], parts[1], parts[2]];
}

export function validateHeader(header: Buffer | string): boolean {
  // Convert Buffer to string if necessary
  const line = typeof header === "string" ? header : header.toString("utf8");

  // Header must contain a colon
  const idx = line.indexOf(":");
  if (idx <= 0) return false; // No colon or colon at start

  // Validate field name
  const fieldName = line.slice(0, idx);
  if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(fieldName)) return false;

  // Check for control chars (except SPACE/tab)
  for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i);
    if (c < 32 && c !== 9) return false; // TAB is OK
    if (c === 127) return false;
  }

  return true;
}

export function parseDec(str: string) {
  return parseInt(str, 10);
}
 
export function fieldGet(headers: Buffer[], key: string): Buffer | null {
  for (const headerBuf of headers) {
    const line = headerBuf.toString("utf8");
    const idx = line.indexOf(":");
    if (idx <= 0) continue; // skip invalid header
    const fieldName = line.slice(0, idx).trim();

    if (fieldName === key) {
      return Buffer.from(line.slice(idx + 1).trim());
    }
  }

  return null;
}

export function encodeHTTPResp(resp: HTTPRes): Buffer {
  // Compose the status-line: HTTP-version SP status-code SP reason-phrase CRLF
  // Example: "HTTP/1.1 200 OK\r\n"
  const statusLine = `HTTP/1.1 ${resp.code} \r\n`;

  // Join all header Buffers into one block separated by CRLF, ending with an extra CRLF for the end of headers
  // Each header already is a Buffer of a header line without the CRLF
  // Ensure headers use CRLF as per spec
  const headersBlock = Buffer.concat(
    [
      // Each header: append CRLF
      ...resp.headers.map(line => {
        // If header line ends with CRLF already, leave it
        return line[line.length - 1] === 0x0a && line[line.length - 2] === 0x0d
          ? line
          : Buffer.concat([line, Buffer.from('\r\n')]);
      }),
      // End-of-headers CRLF
      Buffer.from('\r\n')
    ]
  );

  // Concatenate statusLine and headersBlock into final buffer
  return Buffer.concat([Buffer.from(statusLine), headersBlock]);
}
