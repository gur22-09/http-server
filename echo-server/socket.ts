import * as net from "net";

let server = net.createServer(); // creates a listening socket to bind and listen to address
let sockets: Set<net.Socket> = new Set();

server.on("error", (err: Error) => {
  throw err;
});
server.on("connection", newConn);
server.listen({ hostname: "127.0.0.1", port: 1234 });



function newConn(socket: net.Socket): void {
  console.log("new connection", socket.remoteAddress, socket.remotePort);
  sockets.add(socket);

  socket.on("end", () => {
    // FIN received. The connection will be closed automatically.
    console.log("EOF.");
  });

  socket.on("data", (data: Buffer) => {
    console.log("data:", data);
    if (data.includes("long task")) {
      const now = Date.now();
      while (Date.now() - now < 2 * 60 * 1000) {}
      console.log(`long task by ${socket.remoteAddress} ended`);
    } else {
      socket.write(data); // echo back the data.

      // actively closed the connection if the data contains 'q'
      if (data.includes("quit")) {
        console.log("closing.");
        socket.end(); // this will send FIN and close the connection.
        server.close();
      }
    }
  });
}
