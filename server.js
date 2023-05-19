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

function random(min, max) { return Math.floor(Math.random() * (max + 1 - min)) + min }

function hash(data) {
	const hash = crypto.createHash("sha256")
	hash.update(data)
	return hash.digest("hex")
}

function sendError(res, status, errorMessage) {
	res.status(status).render("error", {
		title: "Error",
		error: errorMessage
	})
}

function databaseError(res) {
	sendError(res, 503, "Error connecting to database.")
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

function makingSureProfilePicturesDirectoryExists() {
	if (fs.existsSync(profilePicturesDirectoryPath)) {
		if (!fs.statSync(profilePicturesDirectoryPath).isDirectory()) {
			fs.unlinkSync(profilePicturesDirectoryPath)
			fs.mkdirSync(profilePicturesDirectoryPath)
		}
	} else {
		fs.mkdirSync(profilePicturesDirectoryPath)
	}
}

function removeProfilePicture(username) {
	makingSureProfilePicturesDirectoryExists()

	fs.readdirSync(profilePicturesDirectoryPath).forEach((file) => {
		const name = file.split(".")[0]
		if (name === username) {
			fs.unlinkSync(profilePicturesDirectoryPath + file)
		}
	})
}

function getProfilePicturePath(username) {
	makingSureProfilePicturesDirectoryExists()

	let path = "user.jpg"

	fs.readdirSync(profilePicturesDirectoryPath).forEach((file) => {
		const name = file.split(".")[0]
		if (name === username) {
			path = "profile-pictures/" + file
			return
		}
	})

	return path
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

const profilePicturesAllowedFormats = ["jpg", "jpeg", "png", "gif"]
const profilePicturesMaxFilesize = 5 // MB
const profilePicturesDirectoryPath = __dirname + "/public/assets/images/profile-pictures/"

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
	let username = undefined
	const ip = req.socket.remoteAddress
	const token = req.cookies["token"]
	const decodedToken = await jwt.verifyToken(ip, token, tokenSecret)
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
	
	let sql = db.prepSQL(`
	SELECT
		salt
	FROM
		users
	WHERE
		username = ?
	`, [username])
	let result = await db.execute(sql)
	if (!result) { databaseError(res); return }

	let valid = result.length === 1

	if (valid) {
		const salt = result[0].salt
		const hashedPassword = hash(salt + req.body.password)

		sql = db.prepSQL(`
		SELECT
			*
		FROM
			users
		WHERE
			username = ? AND password = ?
		`, [username, hashedPassword])
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
		let errorMessage = "You username and password are only allowed to contain the following characters: "
		let firstCharacter = true
		Object.keys(allowedSignUpInputCharacters).forEach((key) => {
			const characterArray = allowedSignUpInputCharacters[key]
			characterArray.forEach((character) => {
				firstCharacter ? errorMessage += character : errorMessage += ", " + character

				if (firstCharacter) { firstCharacter = false }
			})
		})

		sendError(res, 400, errorMessage)
		return
	}

	let sql = db.prepSQL(`
	SELECT
		*
	FROM
		users
	WHERE
		username = ?
	`, [username])
	let result = await db.execute(sql)
	if (!result) { databaseError(res); return }

	const valid = result.length === 0

	if (valid) {
		const salt = crypto.randomBytes(4).toString("hex")
		const hashedPassword = hash(salt + password)
		sql = db.prepSQL(`
		INSERT INTO
			users (username, password, salt)
		VALUES
			(?, ?, ?)
		`, [username, hashedPassword, salt])
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
	const ip = req.socket.remoteAddress
	const token = req.cookies["token"]
	const decodedToken = await jwt.verifyToken(ip, token, tokenSecret)
	const validToken = decodedToken !== false

	let username                    = undefined
	let signUpDate                  = undefined
	let games_played                = undefined
	let correct_guesses_on_others   = undefined
	let correct_guesses_from_others = undefined

	let profilePicturePath = ""

	if (validToken) {
		username = decodedToken.username

		const sql = db.prepSQL(`
		SELECT
			sign_up_date, games_played, correct_guesses_on_others, correct_guesses_from_others
		FROM
			users
		WHERE
			username = ?
		`, [username])
		const result = await db.execute(sql)
		if (!result) { databaseError(res); return }

		signUpDate                  = result[0].sign_up_date.toDateString()
		games_played                = result[0].games_played
		correct_guesses_on_others   = result[0].correct_guesses_on_others
		correct_guesses_from_others = result[0].correct_guesses_from_others

		profilePicturePath = getProfilePicturePath(username)
	}

	res.render("profile", {
		title: "Profile",
		css: ["profile"],
		nav: true,
		loggedIn: validToken,
		username: username,
		signUpDate: signUpDate,
		games_played: games_played,
		correct_guesses_on_others: correct_guesses_on_others,
		correct_guesses_from_others: correct_guesses_from_others,
		profilePicturePath: profilePicturePath
	})
})

app.post("/upload-profile-picture", async (req, res) => {
	const ip = req.socket.remoteAddress
	const token = req.cookies["token"]
	const decodedToken = await jwt.verifyToken(ip, token, tokenSecret)
	const validToken = decodedToken !== false
	if (!validToken) { sendError(res, 401, "Unauthorized.") }

	const username = decodedToken.username

	const form = formidable()

	form.parse(req, (error, fields, file) => {
		if (error) { throw error }

		const upload = fields.upload === "Upload"
		const remove = fields.remove === "Remove"

		if (upload) {
			const tmpPath  = file["profile-picture"].filepath
			const filename = file["profile-picture"].originalFilename
			const filesize = file["profile-picture"].size

			if (filename === "") {
				sendError(res, 400, "You didn't choose a file :|")
				return
			}
	
			const format = filename.split(".")[1]
	
			if (!profilePicturesAllowedFormats.includes(format)) {
				let allowedFormatString = ""
				for (let i = 0; i < profilePicturesAllowedFormats.length; i++) {
					allowedFormatString += profilePicturesAllowedFormats[i]
					if (i < profilePicturesAllowedFormats.length - 1) {
						allowedFormatString += ", "
					}
				}
				sendError(res, 400, "File in wrong format. Your profile picture must be in one of these formats: " + allowedFormatString + ".")
				return
			}
	
			if (bytesToMegabytes(filesize) > profilePicturesMaxFilesize) {
				sendError(res, 400, "File too large. Files must be under 5 MB.")
				return
			}
	
			removeProfilePicture(username)
	
			const newPath = profilePicturesDirectoryPath + username + "." + format
			fs.writeFileSync(newPath, fs.readFileSync(tmpPath))
			res.redirect("/profile")
		} else if (remove) {
			removeProfilePicture(username)
			res.redirect("/profile")
		} else {
			sendError(res, 400, "This shouldn't happen :|")
		}
	})
})

app.get("/sign-out", (req, res) => {
	res.clearCookie("token")
	res.redirect("/")
})

app.get("/stats", async (req, res) => {
	const sql = `
	SELECT
		username, sign_up_date, games_played, correct_guesses_on_others, correct_guesses_from_others
	FROM
		users
	`
	const result = await db.execute(sql)
	if (!result) { databaseError(res); return }

	result.forEach((user) => {
		user.sign_up_date       = user.sign_up_date.toDateString()
		user.profilePicturePath = getProfilePicturePath(user.username)
	})

	res.render("stats", {
		title: "stats",
		css: ["stats"],
		nav: true,
		stats: result
	})
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

		if (!game.playing && playingBefore) {
			console.log("[Game]: Ending round because of too few players.")
			await game.endRound()
		}

		if (game.playing && !playingBefore) { game.startRound() }
	},

	updateLobby: (io) => {
		game.updatePlayingStatus()

		const players = {}
		game.getPlayers().forEach((socketId) => {
			const player = game.lobby[socketId]

			let profilePicturePath = "user.jpg"
			if (!player.guest) {
				profilePicturePath = getProfilePicturePath(player.name)
			}

			players[socketId] = {
				idNameString: game.getPlayerIdNameString(socketId),
				profilePicturePath: profilePicturePath
			}
		})

		io.in("game").emit("game-lobby-change", players)
	},

	existsInLobby: (socketId) => {
		return game.lobby[socketId] !== undefined
	},

	getPlayerIdNameString: (socketId) => {
		if (!game.existsInLobby(socketId)) { return "NOT DEFINED" }
		const player = game.lobby[socketId]
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
		console.log("[Game]: Round started")
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
		if (game.existsInLobby(game.drawer)) {
			io.in("game").emit("game-server-message", `The word that ${game.getPlayerIdNameString(game.drawer)} had was "${game.word}".`)
		}

		await game.updatePlayerProfiles()

		game.playing = false
		if (game.existsInLobby(game.drawer)) {
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
		if (game.correctPlayers.length === 0) { return }

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
			console.log("[Game]: Ending round because every player is correct.")
			await game.endRound()
		}
	},

	updatePlayerProfiles: async () => {
		const players = game.getPlayers()

		for (let i = 0; i < players.length; i++) {
			const socketId = players[i]
			const player = game.lobby[socketId]
			if (!player.guest) {
				const wasDrawer = socketId === game.drawer

				let sql = db.prepSQL(`
				SELECT
					id, games_played, correct_guesses_on_others, correct_guesses_from_others
				FROM
					users
				WHERE
					username = ?
				`, [player.name])
				let result = await db.execute(sql)
				if (!result) { console.log("[Game]: Database error.") }

				const id                        = result[0].id
				let games_played                = result[0].games_played
				let correct_guesses_on_others   = result[0].correct_guesses_on_others
				let correct_guesses_from_others = result[0].correct_guesses_from_others

				games_played++
				if (game.correctPlayers.includes(socketId)) {
					correct_guesses_on_others++
				}
				if (wasDrawer) {
					correct_guesses_from_others += game.correctPlayers.length
				}

				sql = db.prepSQL(`
				UPDATE
					users
				SET
					games_played = ?, correct_guesses_on_others = ?, correct_guesses_from_others = ?
				WHERE
					id = ?
				`, [games_played, correct_guesses_on_others, correct_guesses_from_others, id])
				result = await db.execute(sql)
				if (!result) { console.log("[Game]: Database error.") }
			}
		}
	}
}

io.on("connection", (socket) => {
	socket.on("disconnect", async () => {
		if (game.getPlayers().includes(socket.id)) {
			console.log(`[Game]: ${game.getPlayerIdNameString(socket.id)} (${socket.id}) left.`)
			socket.to("game").emit("game-server-message", `${game.getPlayerIdNameString(socket.id)} left.`)

			delete game.lobby[socket.id]
			const playerDrawQueueIndex = game.playerDrawQueue.indexOf(socket.id)
			if (playerDrawQueueIndex !== -1) {
				game.playerDrawQueue.splice(playerDrawQueueIndex, 1)
			}

			if (socket.id === game.drawer) {
				console.log("[Game]: Ending round because of drawer leaving.")
				await game.endRound()
			}

			game.updateLobby(io)

			game.validatePlayersCorrectness()
		}
	})

	socket.on("game-join", async (token) => {
		const ip = socket.handshake.address
		const decodedToken = await jwt.verifyToken(ip, token, tokenSecret)

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

		console.log(`[Game]: ${game.getPlayerIdNameString(socket.id)} (${socket.id}) joined.`)
		socket.to("game").emit("game-server-message", `${game.getPlayerIdNameString(socket.id)} joined.`)
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

		// correct guess
		if (senderSocketId !== game.drawer && message.toLowerCase() === game.word.toLowerCase()) {
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
			console.log("[Game]: Ending round because time is over.")
			await game.endRound()
		}
	}
}, interval * 1000)
