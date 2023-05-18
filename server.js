// npm packages
const bodyParser   = require("body-parser")
const cookieParser = require("cookie-parser")
const crypto       = require("crypto")
const express      = require("express")
const formidable   = require("formidable")
const fs           = require("fs")
const handlebars   = require("express-handlebars")
const http         = require("http")
const { Server }   = require("socket.io")
// services
const db           = require("./services/db")
const jwt          = require("./services/jwt")
const { decode } = require("punycode")

function random(min, max) { return Math.floor(Math.random() * (max + 1 - min)) + min }

function hash(data) {
	const hash = crypto.createHash("sha256")
	hash.update(data)
	return hash.digest("hex")
}

function databaseError(res) {
	res.status(503).render("error", { error: "Error connecting to database." })
}

function bytesToMegabytes(bytes) {
	return bytes / (1000 * 1000)
}

function validateSignUpInput(input) {
	let validInput = true

	for (let i = 0; i < input.length; i++) {
		const letter = input[i]
		const inNumbers = allowedSignUpInputCharacters.numbers.includes(letter)
		if (inNumbers) { continue }

		const inAlphabet = allowedSignUpInputCharacters.alphabet.includes(letter)
		if (inAlphabet) { continue }

		const inSpecial = allowedSignUpInputCharacters.special.includes(letter)
		if (inSpecial) { continue }

		validInput = false
	}

	return validInput
}

const allowedSignUpInputCharacters = {
	numbers: [
		"0", "1", "2", "3", "4", "5", "6", "7", "8", "9"
	],
	alphabet: [
		"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "L", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "Å", "Ä", "Ö",
		"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "å", "ä", "ö"
	],
	special: [
		"!", "?", "@", "£", "$", "%", "&", "=", "+", "-", "_"
	]
}

const profilePictureAllowedFormats = ["jpg", "jpeg", "png", "gif"]
const profilePictureMaxFilesize = 5 // MB

const tokenSecret = hash("ʕ •ᴥ•ʔ")

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
	const decodedToken = await jwt.verifyToken(token, tokenSecret)
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
			jwt.setToken(res, user.id, user.username, tokenSecret)
		}
	}

	valid ? res.redirect("/") : res.redirect("/sign-in?error=true")
})

app.post("/sign-up", async (req, res) => {
	const username = req.body.username
	const password = req.body.password

	const validUsername = validateSignUpInput(username)
	const validPassword = validateSignUpInput(password)

	if (!validUsername || !validPassword) {
		let errorText = "You username and password are only allowed to contain the following characters: "
		let firstCharacter = true
		Object.keys(allowedSignUpInputCharacters).forEach((key) => {
			const characterArray = allowedSignUpInputCharacters[key]
			characterArray.forEach((character) => {
				firstCharacter ? errorText += character : errorText += ", " + character

				if (firstCharacter) { firstCharacter = false }
			})
		})

		res.status(400).render("error", { error: errorText })
		return
	}

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
		jwt.setToken(res, result.insertId, username, tokenSecret)
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
	const decodedToken = await jwt.verifyToken(token, tokenSecret)
	const validToken = decodedToken !== false

	let profilePicturePath = false

	if (validToken) {
		fs.readdirSync(__dirname + "/public/assets/images/profile-pictures/").forEach((file) => {
			const name = file.split(".")[0]
			if (name === decodedToken.username) {
				profilePicturePath = file
			}
		})
	}

	res.render("profile", {
		title: "Profile",
		css: ["profile"],
		nav: true,
		loggedIn: validToken,
		profilePicturePath: profilePicturePath
	})
})

app.post("/upload-profile-picture", async (req, res) => {
	const token = req.cookies["token"]
	const decodedToken = await jwt.verifyToken(token, tokenSecret)
	const validToken = decodedToken !== false
	if (!validToken) {
		res.status(401).render("error", { error: "Unauthorized." })
	}

	const username = decodedToken.username

	const form = formidable()

	form.parse(req, (error, fields, file) => {
		if (error) { throw error }
		const tmpPath  = file["profile-picture"].filepath
		const filename = file["profile-picture"].originalFilename
		const filesize = file["profile-picture"].size

		const format = filename.split(".")[1]

		if (!profilePictureAllowedFormats.includes(format)) {
			let allowedFormatString = ""
			for (let i = 0; i < profilePictureAllowedFormats.length; i++) {
				allowedFormatString += profilePictureAllowedFormats[i]
				if (i < profilePictureAllowedFormats.length - 1) {
					allowedFormatString += ", "
				}
			}
			res.status(400).render("error", { error: "File in wrong format. Your profile picture must be in one of these formats: " + allowedFormatString + "."})
			return
		}

		if (bytesToMegabytes(filesize) > profilePictureMaxFilesize) {
			res.status(400).render("error", { error: "File too large. Files must be under 5 MB." })
			return
		}

		fs.readdirSync(__dirname + "/public/assets/images/profile-pictures/").forEach((file) => {
			const name = file.split(".")[0]
			if (name === username) {
				fs.unlinkSync(__dirname + "/public/assets/images/profile-pictures/" + file)
			}
		})

		const newPath = __dirname + "/public/assets/images/profile-pictures/" + username + "." + format
		fs.writeFileSync(newPath, fs.readFileSync(tmpPath))
		res.redirect("/profile")
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
	secondsPerRound: 60,
	word: undefined,
	drawer: undefined,
	playerDrawQueue: [],
	roundFillColor: undefined,
	roundDrawerCommands: [],
	correctPlayers: [],

	addToLobby: (socketId, name, guest = false) => {
		game.lobby[socketId] = { id: game.lobbyCounter, name: name, guest: guest }
		game.lobbyCounter++
	},

	getPlayers: () => {
		return Object.keys(game.lobby)
	},

	getValidPlayingPlayerCount: () => {
		return game.getPlayers().length >= 2
	},

	updatePlayingStatus: async () => {
		const playingBefore = game.playing
		game.playing = game.getValidPlayingPlayerCount()

		if (!game.playing && playingBefore) { await game.endRound() }

		if (game.playing && !playingBefore) { game.startRound() }
	},

	updateLobby: (io) => {
		game.updatePlayingStatus()
		io.in("game").emit("game-lobby-change", game)
	},

	getPlayerIdNameString: (socketId) => {
		const player = game.lobby[socketId]
		if (!player) { return "NOT DEFINED" }
		return `#${player.id} ${player.name}`
	},

	getStatusMessage: (status) => {
		switch (status) {
			case "waiting":
				return "Waiting for other players."
			case "drawing":
				return `<span class="you">You are drawing "${game.word}".</span>`
			case "guessing":
				return `<b>${game.getPlayerIdNameString(game.drawer)}</b> is drawing a ${game.word.length} letter word.`
			case "correct":
				return `You guessed the drawing by <b>${game.getPlayerIdNameString(game.drawer)}</b> correctly! The word was "${game.word}".`
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

		const now = new Date()
		game.roundStartTime = now.getTime()
	},

	endRound: async () => {
		await game.givePointsToNonGuests()

		game.playing = false
		if (game.drawer) {
			game.playerDrawQueue.push(game.drawer)
		}
		game.roundStartTime = undefined
		game.word           = undefined
		game.drawer         = undefined
		game.roundFillColor = undefined
		game.roundDrawerCommands.length = 0
		game.correctPlayers     .length = 0
		io.in("game").emit("game-round-end")
		io.in("game").emit("game-set-status", game.getStatusMessage("waiting"))
		game.updatePlayingStatus()
	},

	validatePlayersCorrectness: async () => {
		let everyPlayerIsCorrect = true

		const players = game.getPlayers()

		for (let i = 0; i < players.length; i++) {
			const player = players[i]
			if (player === game.drawer) { continue }
			if (!game.correctPlayers.includes(player)) {
				everyPlayerIsCorrect = false
				break
			}
		}

		if (everyPlayerIsCorrect) {
			await game.endRound()
		}
	},

	givePointsToNonGuests: async () => {
		let loopedThroughFirstPlayer = false
		game.correctPlayers.forEach(async (socketId) => {
			const player = game.lobby[socketId]
			if (!player.guest) {
				let sql = db.prepSQL("SELECT id, wins, correct_guesses FROM users WHERE username = ?", [player.name])
				let result = await db.execute(sql)
				if (!result) { console.log("Database error.") }
				const id            = result[0].id
				let wins            = result[0].wins
				let correct_guesses = result[0].correct_guesses

				if (!loopedThroughFirstPlayer) {
					wins++
				}
				correct_guesses++

				sql = db.prepSQL("UPDATE users SET wins = ?, correct_guesses = ? WHERE id = ?", [wins, correct_guesses, id])
				result = await db.execute(sql)
				if (!result) { console.log("Database error.") }
			}
			loopedThroughFirstPlayer = true
		})
	}
}

io.on("connection", (socket) => {
	socket.on("disconnect", async () => {
		if (game.getPlayers().includes(socket.id)) {
			socket.to("game").emit("game-server-message", `${game.getPlayerIdNameString(socket.id)} just left.`)

			if (socket.id === game.drawer) {
				await game.endRound()
			}

			delete game.lobby[socket.id]
			const playerDrawQueueIndex = game.playerDrawQueue.indexOf(socket.id)
			game.playerDrawQueue.splice(playerDrawQueueIndex, 1)
			game.updateLobby(io)

			game.validatePlayersCorrectness()
		}
	})

	socket.on("game-join", async (token) => {
		const decodedToken = await jwt.verifyToken(token, tokenSecret)

		const username = decodedToken.username

		if (username === undefined) {
			game.addToLobby(socket.id, "guest", true)
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
			socket.emit("game-round-start")
			if (game.roundFillColor) {
				socket.emit("game-fill", game.roundFillColor)
			}
			socket.emit("game-load-canvas", game.roundDrawerCommands)
			socket.emit("game-set-status", game.getStatusMessage("guessing"))
		} else {
			socket.emit("game-set-status", game.getStatusMessage("waiting"))
		}
	})

	socket.on("game-clear", (socketId) => {
		if (socketId !== game.drawer) { return }

		game.roundDrawerCommands.length = 0
		game.roundFillColor = undefined
		io.in("game").emit("game-clear")
	})

	socket.on("game-fill", (socketId, color) => {
		if (socketId !== game.drawer) { return }

		game.roundDrawerCommands.length = 0
		game.roundFillColor = color
		io.in("game").emit("game-fill", color)
	})

	socket.on("game-draw", (socketId, size, color, position, dot) => {
		if (socketId === game.drawer) {
			game.roundDrawerCommands.push({
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
			socket.emit("game-set-status", game.getStatusMessage("correct"))
			socket.emit("game-correct-guess")

			game.validatePlayersCorrectness()
		} else {
			io.in("game").emit("game-player-message", senderSocketId, id, name, message)
		}
	})
})

const interval = 0.1 // seconds

setInterval(async () => {
	if (game.playing) {
		const now = new Date()
		const millisecondsSinceRoundStart = now.getTime() - game.roundStartTime
		const secondsSinceRoundStart = millisecondsSinceRoundStart / 1000
		const timerPercentage = 100 * secondsSinceRoundStart / game.secondsPerRound
		io.in("game").emit("game-update-timer", timerPercentage)
		if (timerPercentage >= 100) {
			await game.endRound()
		}
	}
}, interval * 1000)
