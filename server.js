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

app.get("/sign-in", (req, res) => {
	res.render("sign-in", {
		title: "Sign in",
		css: ["account-form"],
		js: ["sign-in"]
	})
})

app.get("/sign-up", (req, res) => {
	res.render("sign-up", {
		title: "Sign up",
		css: ["account-form", "sign-up"],
		js: ["sign-up"]
	})
})

app.post("/sign-in", async (req, res) => {
	const username = req.body.username
	
	let sql = db.prepSQL("SELECT salt FROM users WHERE username = ?", [username])
	let result = await db.SELECT(sql)
	if (!result) { databaseError(res); return }

	let valid = result.length === 1

	if (valid) {
		const salt = result[0].salt
		const hashedPassword = hash(salt + req.body.password)

		sql = db.prepSQL("SELECT * FROM users WHERE username = ? AND password = ?", [username, hashedPassword])
		result = await db.SELECT(sql)
		if (!result) { databaseError(res); return }

		valid = result.length === 1

		if (valid) {
			const user = result[0]
			jwt.setToken(res, user.id, user.username)
		}
	}

	res.render("sign-in-attempt", {
		title: "Sign in",
		valid: valid,
		username: username
	})
})

app.post("/sign-up", async (req, res) => {
	const username = req.body.username
	const password = req.body.password

	let sql = db.prepSQL("SELECT * FROM users WHERE username = ?", [username])
	let result = await db.SELECT(sql)
	if (!result) { databaseError(res); return }

	const valid = result.length === 0

	if (valid) {
		const salt = crypto.randomBytes(4).toString("hex")
		const hashedPassword = hash(salt + password)
		sql = db.prepSQL("INSERT INTO users (username, password, salt) VALUES (?, ?, ?)", [username, hashedPassword, salt])
		result = await db.EXECUTE(sql)
		if (!result) { databaseError(res); return }
	}

	res.render("sign-up-attempt", {
		title: "Sign up",
		valid: valid,
		username: username
	})
})

app.get("/game", (req, res) => {
	res.render("game", {
		title: "Game",
		js: ["game"],
		socket: true
	})
})

app.get("/already-playing", (req, res) => {
	res.render("already-playing", {
		title: "Already playing"
	})
})

server.listen(port, () => {
	console.log(`Server listening on port ${port}.`)
})

const lobby = {}

io.on("connection", (socket) => {
	socket.on("disconnect", () => {
		if (Object.keys(lobby).includes(socket.id)) {
			delete lobby[socket.id]
			io.in("game").emit("game-lobby-change", lobby)
		}
	})

	socket.on("game-join", async (token) => {
		const decodedToken = await jwt.verifyToken(token)

		const username = decodedToken.username

		if (username === undefined) {
			lobby[socket.id] = "guest"
		} else if (!Object.values(lobby).includes(username)) {
			lobby[socket.id] = username
		} else {
			socket.emit("game-already-playing")
			return
		}

		socket.join("game")

		io.in("game").emit("game-lobby-change", lobby)
	})

	socket.on("game-win", () => {
		console.log("won:", lobby[socket.id])
	})
})
