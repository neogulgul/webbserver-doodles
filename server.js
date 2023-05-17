// npm packages
const bodyParser   = require("body-parser")
const cookieParser = require("cookie-parser")
const crypto       = require("crypto")
const express      = require("express")
const handlebars   = require("express-handlebars")
const http         = require("http")
const { Server }   = require("socket.io")
// services
const db           = require("./services/db")
const jwt          = require("./services/jwt")

function hash(data) {
	const hash = crypto.createHash("sha256")
	hash.update(data)
	return hash.digest("hex")
}

function databaseError(res) {
	res.status(503).render("error", { error: "Error connecting to database." })
}

const port = 3000

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(express.static(__dirname + "/public"))

app.set("view engine", "handlebars")
app.engine("handlebars", handlebars.engine({
	defaultLayout: "main",
	layoutsDir: __dirname + "/views/layouts"
}))

app.get("/", async (req, res) => {
	let username = ""
	const token = req.cookies["token"]
	const decodedToken = await jwt.verifyToken(token)
	const validToken = decodedToken !== false
	if (validToken) { username = decodedToken.username }

	res.render("index", {
		title: "Home",
		nav: true,
		loggedIn: validToken,
		username: username
	})
})

app.get("/sign-in", async (req, res) => {
	const error = req.query["error"] === "true"

	res.render("sign-in", {
		title: "Sign in",
		css: ["account-form"],
		js: ["sign-in"],
		homeButton: true,
		error: error
	})
})

app.get("/sign-up", (req, res) => {
	const error = req.query["error"] === "true"

	res.render("sign-up", {
		title: "Sign up",
		css: ["account-form", "sign-up"],
		js: ["sign-up"],
		homeButton: true,
		error: error
	})
})

app.post("/sign-in", async (req, res) => {
	const username = req.body.username
	
	let sql = db.prepSQL("SELECT salt FROM users WHERE username = ?", [username])
	let result = await db.execute(sql)
	if (!result) { databaseError(res); return }

	let valid = result.length === 1

	if (valid) {
		const salt = result[0].salt
		const hashedPassword = hash(salt + req.body.password)

		sql = db.prepSQL("SELECT * FROM users WHERE username = ? AND password = ?", [username, hashedPassword])
		result = await db.execute(sql)
		if (!result) { databaseError(res); return }

		valid = result.length === 1

		if (valid) {
			const user = result[0]
			jwt.setToken(res, user.id, user.username)
		}
	}

	valid ? res.redirect("/") : res.redirect("/sign-in?error=true")
})

app.post("/sign-up", async (req, res) => {
	const username = req.body.username
	const password = req.body.password

	let sql = db.prepSQL("SELECT * FROM users WHERE username = ?", [username])
	let result = await db.execute(sql)
	if (!result) { databaseError(res); return }

	const valid = result.length === 0

	if (valid) {
		const salt = crypto.randomBytes(4).toString("hex")
		const hashedPassword = hash(salt + password)
		sql = db.prepSQL("INSERT INTO users (username, password, salt) VALUES (?, ?, ?)", [username, hashedPassword, salt])
		result = await db.execute(sql)
		if (!result) { databaseError(res); return }
		jwt.setToken(res, result.insertId, username)
	}

	valid ? res.redirect("/") : res.redirect("/sign-up?error=true")
})

app.get("/game", (req, res) => {
	res.render("game", {
		title: "Game",
		css: ["game"],
		js: ["game"],
		socket: true,
		homeButton: true
	})
})

app.get("/already-playing", (req, res) => {
	res.render("already-playing", {
		title: "Already playing"
	})
})

app.get("/profile", async (req, res) => {
	const token = req.cookies["token"]
	const decodedToken = await jwt.verifyToken(token)
	const validToken = decodedToken !== false

	res.render("profile", {
		title: "Profile",
		nav: true,
		loggedIn: validToken
	})
})

app.get("/sign-out", (req, res) => {
	res.clearCookie("token")
	res.redirect("/")
})

server.listen(port, () => {
	console.log(`Server listening on port ${port}.`)
})

const game = {
	playing: false,
	lobby: {},
	lobbyCounter: 0,
	drawer: undefined,
	drawQueue: [],
	addToLobby: (socketId, name) => {
		game.lobby[socketId] = { id: game.lobbyCounter, name: name }
		game.lobbyCounter++
	},
	getPlayerCount: () => {
		return Object.keys(game.lobby).length
	},
	updatePlayingStatus: () => {
		game.playing = game.getPlayerCount() >= 2
	},
	updateLobby: (io) => {
		game.updatePlayingStatus()
		io.in("game").emit("game-lobby-change", game)

		console.clear()
		console.log("Draw Queue:")
		game.drawQueue.forEach((socketId) => {
			const player = game.lobby[socketId]
			console.log(`#${player.id} ${player.name}`)
		})
	}
}

io.on("connection", (socket) => {
	socket.on("disconnect", () => {
		if (Object.keys(game.lobby).includes(socket.id)) {
			const player = game.lobby[socket.id]
			socket.to("game").emit("game-server-message", `#${player.id} ${player.name} just left.`)

			delete game.lobby[socket.id]
			const drawQueueIndex = game.drawQueue.indexOf(socket.id)
			game.drawQueue.splice(drawQueueIndex, 1)
			game.updateLobby(io)
		}
	})

	socket.on("game-join", async (token) => {
		const decodedToken = await jwt.verifyToken(token)

		const username = decodedToken.username

		if (username === undefined) {
			game.addToLobby(socket.id, "guest")
		} else {
			let alreadyPlaying = false

			const players = Object.values(game.lobby)

			for (let i = 0; i < players.length; i++) {
				if (players[i].name === username) {
					alreadyPlaying = true
					break
				}
			}

			if (alreadyPlaying) {
				socket.emit("game-already-playing")
				return
			}

			game.addToLobby(socket.id, username)
		}

		socket.join("game")
		game.drawQueue.push(socket.id)
		game.updateLobby(io)

		const player = game.lobby[socket.id]
		socket.to("game").emit("game-server-message", `#${player.id} ${player.name} just joined.`)
	})

	socket.on("game-clear", () => {
		socket.to("game").emit("game-clear")
	})

	socket.on("game-draw", (size, color, position, dot) => {
		socket.to("game").emit("game-draw", size, color, position, dot)
	})

	socket.on("game-player-message", (senderSocketId, message) => {
		const   id = game.lobby[senderSocketId].id
		const name = game.lobby[senderSocketId].name
		io.in("game").emit("game-player-message", senderSocketId, id, name, message)
	})
})
