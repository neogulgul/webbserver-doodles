// npm packages
const bodyParser   = require("body-parser")
const cookieParser = require("cookie-parser")
const crypto       = require("crypto")
const express      = require("express")
const handlebars   = require("express-handlebars")
const fs           = require("fs")
const http         = require("http")
const { Server }   = require("socket.io")
// services
const db           = require("./services/db")
const jwt          = require("./services/jwt")

function random(min, max) { return Math.floor(Math.random() * (max + 1 - min)) + min }

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
	roundStartTime: undefined,
	secondsPerRound: 120,
	word: undefined,
	drawer: undefined,
	playerDrawQueue: [],
	drawCommandsDuringRound: [],
	correctPlayers: [],

	addToLobby: (socketId, name) => {
		game.lobby[socketId] = { id: game.lobbyCounter, name: name }
		game.lobbyCounter++
	},

	getPlayerCount: () => {
		return Object.keys(game.lobby).length
	},

	getValidPlayingPlayerCount: () => {
		return game.getPlayerCount() >= 2
	},

	updatePlayingStatus: () => {
		const playingBefore = game.playing
		game.playing = game.getValidPlayingPlayerCount()

		if (!game.playing && playingBefore) { game.endRound() }

		if (game.playing && !playingBefore) { game.startRound() }
	},

	updateLobby: (io) => {
		game.updatePlayingStatus()
		io.in("game").emit("game-lobby-change", game)
	},

	getPlayerIdNameString: (socketId) => {
		const player = game.lobby[socketId]
		return `#${player.id} ${player.name}`
	},

	getStatusMessage: (status) => {
		switch (status) {
			case "waiting":
				return "Waiting for other players."
			case "drawing":
				return `You are drawing a ${game.word}.`
			case "guessing":
				return `${game.getPlayerIdNameString(game.drawer)} is drawing a ${game.word.length} letter word.`
			case "correct":
				return `You guessed the drawing by ${game.drawer} correctly! The word was ${game.word}.`
			default:
				return "ERROR."
		}
	},

	startRound: () => {
		const words = JSON.parse(fs.readFileSync("words.json", "utf-8"))
		const index = random(0, words.length - 1)
		game.word = words[index]

		game.drawer = game.playerDrawQueue[0]
		game.playerDrawQueue.shift()
		io.in("game").emit("game-round-start", game.drawer)
		io.in("game").emit("game-server-message", `${game.getPlayerIdNameString(game.drawer)} is drawing.`)

		io.in("game").emit("game-set-status", game.getStatusMessage("guessing"))
		io.to(game.drawer).emit("game-set-status", game.getStatusMessage("drawing"))
	},

	endRound: () => {
		game.playing = false
		game.playerDrawQueue.push(game.drawer)
		game.roundStartTime = undefined
		game.word           = undefined
		game.drawer         = undefined
		game.drawCommandsDuringRound.length = 0
		game.correctPlayers         .length = 0
		io.in("game").emit("game-round-end")
		io.in("game").emit("game-set-status", game.getStatusMessage("waiting"))

		game.updatePlayingStatus()
	}
}

io.on("connection", (socket) => {
	socket.on("disconnect", () => {
		if (Object.keys(game.lobby).includes(socket.id)) {
			socket.to("game").emit("game-server-message", `${game.getPlayerIdNameString(socket.id)} just left.`)

			if (socket.id === game.drawer) {
				game.endRound()
			}

			delete game.lobby[socket.id]
			const playerDrawQueueIndex = game.playerDrawQueue.indexOf(socket.id)
			game.playerDrawQueue.splice(playerDrawQueueIndex, 1)
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

		socket.to("game").emit("game-server-message", `${game.getPlayerIdNameString(socket.id)} just joined.`)
		socket.join("game")
		game.playerDrawQueue.push(socket.id)
		game.updateLobby(io)

		if (game.playing) {
			socket.emit("game-load-canvas", game.drawCommandsDuringRound)
			socket.emit("game-set-status", game.getStatusMessage("guessing"))
		} else {
			socket.emit("game-set-status", game.getStatusMessage("waiting"))
		}
	})

	socket.on("game-clear", (socketId) => {
		if (socketId === game.drawer) {
			io.in("game").emit("game-clear")
		}
	})

	socket.on("game-draw", (socketId, size, color, position, dot) => {
		if (socketId === game.drawer) {
			game.drawCommandsDuringRound.push({
				size: size,
				color: color,
				position: position,
				dot: dot
			})
			io.in("game").emit("game-draw", size, color, position, dot)
		}
	})

	socket.on("game-player-message", (senderSocketId, message) => {
		if (!game.playing || game.correctPlayers.includes[senderSocketId]) { return }

		const   id = game.lobby[senderSocketId].id
		const name = game.lobby[senderSocketId].name

		if (senderSocketId !== game.drawer && message === game.word) {
			game.correctPlayers.push(senderSocketId)
			io.in("game").emit("game-server-message", `${game.getPlayerIdNameString(senderSocketId)} guessed correctly.`)
			socket.emit("game-correct-guess")

			const everyPlayerIsCorrect = game.getPlayerCount() - 1 === game.correctPlayers.length
			if (everyPlayerIsCorrect) {
				game.endRound()
			}
		} else {
			io.in("game").emit("game-player-message", senderSocketId, id, name, message)
		}
	})
})
