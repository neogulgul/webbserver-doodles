const db = require("./db")
const jwt = require("jsonwebtoken")

function setToken(res, id, username, tokenSecret, tokenHours = 24) {
	const token = jwt.sign({
		sub: id,
		username: username
	}, tokenSecret, { expiresIn: 60 * 60 * tokenHours })
	res.cookie("token", token)
}

async function verifyToken(ip, token, tokenSecret) {
	if (!token) { return false }

	try {
		const decoded = jwt.verify(token, tokenSecret)

		const id = decoded.sub
		const sql = db.prepSQL("SELECT * FROM users WHERE id = ?", [id])
		const result = await db.execute(sql)
		if (!result) { return false }

		const valid = result.length === 1
		if (valid) { return decoded }
	} catch (error) {
		// console.log(error)
		console.log(`${ip} had an invalid token.`)
	}

	return false
}

module.exports = {
	setToken,
	verifyToken
}
