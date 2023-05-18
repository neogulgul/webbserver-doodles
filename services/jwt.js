const db = require("./db")
const jwt = require("jsonwebtoken")

const tokenHours = 24
const tokenSecret = "ʕ •ᴥ•ʔ"

function setToken(res, id, username) {
	const token = jwt.sign({
		sub: id,
		username: username
	}, tokenSecret, { expiresIn: 60 * 60 * tokenHours })
	res.cookie("token", token)
}

async function verifyToken(token) {
	if (token === undefined) { return false }

	try {
		const decoded = jwt.verify(token, tokenSecret)

		const id = decoded.sub
		const sql = db.prepSQL("SELECT * FROM users WHERE id = ?", [id])
		const result = await db.execute(sql)
		if (!result) { return false }

		const valid = result.length === 1
		if (valid) { return decoded }
	} catch (err) {
		// console.log(err)
		console.log("Token was invalid.")
	}

	return false
}

module.exports = {
	setToken,
	verifyToken
}
