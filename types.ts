import { Socket } from 'net'

// A promise-based API for TCP sockets.
export type TCPConn = {
  // the JS socket object
  socket: Socket;
  // the callbacks of the promise of the current read
  reader: null | {
    resolve: (value: Buffer) => void;
    reject: (reason: Error) => void;
  };
  // for the error event
  error: null | Error;
  // for EOF from end event
  ended: boolean;
};

export type DynamicBuffer = {
  data: Buffer;
  len: number;
};

export type HTTPReq = {
  method: string;
  uri: Buffer;
  headers: Buffer[]
  version: string
}

export type HTTPRes = {
  code: number;
  headers: Buffer[];
  body: BodyReader
}

// an interface for reading/writing data from/to the HTTP body.
export type BodyReader = {
    // the "Content-Length", -1 if unknown.
    length: number,
    // read data. returns an empty buffer after EOF.
    read: () => Promise<Buffer>,
};