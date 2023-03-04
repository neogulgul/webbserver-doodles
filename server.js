const express = require("express")
const app = express()
const http = require("http")
const server = http.createServer(app)
const { Server } = require("socket.io")
const io = new Server(server)

const port = 3000

app.use(express.static(__dirname + "/public"))

app.get("/", (req, res) => {
	res.sendFile(__dirname + "/public/html/index.html")
})

server.listen(port, () => {
	console.log(`Example app listening on port ${port}.`)
})

io.on("connection", async (socket) => {
	socket.on("clear", () => {
		socket.broadcast.emit("clear")
	})
	socket.on("draw", (size, color, position, dot) => {
		socket.broadcast.emit("draw", size, color, position, dot)
	})
})
