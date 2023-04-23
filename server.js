const express = require("express")
const app = express()
const cookieParser = require("cookie-parser")
const http = require("http")
const server = http.createServer(app)
const { Server } = require("socket.io")
const io = new Server(server)
const bodyParser = require("body-parser")
const jwt = require("jsonwebtoken")
const handlebars = require("express-handlebars")
const crypto = require("crypto")
const db = require("./services/db")

const port = 3000

const tokenHours = 240
const secret = "secret"

let sql

function hash(data) {
	const hash = crypto.createHash("sha256")
	hash.update(data)
	return hash.digest("hex")
}

app.use(express.static(__dirname + "/public"))
app.use(express.static(__dirname + "/public/html"))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.use(cookieParser())

app.set("view engine", "handlebars")
app.engine("handlebars", handlebars.engine({
	defaultLayout: "main",
	layoutsDir: __dirname + "/views/layouts"
}))

app.get("/", (req, res) => {
	let loggedIn = false
	let username = ""
	const token = req.cookies["jwt"]
	if (token) {
		let decoded
		try {
			decoded = jwt.verify(token, secret)
			loggedIn = true
			username = decoded.username
		} catch(err) {
			console.log(err)
			res.status(401).send("Invalid auth token.")
			return
		}
	}
	res.render("index", {
		title: "Home",
		css: ["index"],
		nav: true,
		loggedIn: loggedIn,
		username: username
	})
})

app.get("/sign-in", (req, res) => {
	res.render("sign-in", {
		css: ["account-form"],
		js: ["sign-in"]
	})
})

app.get("/sign-up", (req, res) => {
	res.render("sign-up", {
		css: ["account-form", "sign-up"],
		js: ["sign-up"]
	})
})

app.post("/sign-in", async (req, res) => {
	const username = req.body.username
	const password = hash(req.body.password)
	sql = db.prepSQL(`
	SELECT
		*
	FROM
		users
	WHERE
		username = ?
	AND
		password = ?
	`, [username, password])
	const result = await db.SELECT(sql)
	const valid = result.length === 1
	if (valid) {
		const user = result[0]
		const token = jwt.sign({
			sub: user.id,
			exp: Math.floor(Date.now() / 1000) + (60 * 60 * tokenHours),
			username: user.username
		}, secret)
		res.cookie("jwt", token)
	}
	res.render("sign-in-attempt", {
		valid: valid
	})
})

app.post("/sign-up", async (req, res) => {
	const username = req.body.username
	sql = db.prepSQL(`
	SELECT
		COUNT(*)
	FROM
		users
	WHERE
		username = ?
	`, [username])
	const result = await db.SELECT(sql)
	const valid = Object.values(result[0])[0] !== 1
	if (valid) {
		const password = hash(req.body.password)
		sql = db.prepSQL(`
		INSERT INTO users
			(username, password)
		VALUES
			(?, ?)
		`, [username, password])
		await db.INSERT(sql)
	}
	res.render("sign-up-attempt", {
		username: username,
		valid: valid
	})
})

server.listen(port, () => {
	console.log(`Server listening on port ${port}.`)
})

io.on("connection", (socket) => {
	console.log("new connection:", socket.id)
})
