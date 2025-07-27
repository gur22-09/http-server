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