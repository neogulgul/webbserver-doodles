const mysql = require("mysql2/promise")

async function getConnection() {
	return mysql.createConnection({
		host: "localhost",
		user: "root",
		password: "",
		database: "doodles"
	})
}

async function SELECT(statement) {
	try {
		const connection = await getConnection()
		const result = await connection.execute(statement)
		await connection.end()
		return result[0]
	} catch (err) {
		console.log(err)
		return false
	}
}

async function EXECUTE(statement) {
	try {
		const connection = await getConnection()
		await connection.execute(statement)
		await connection.end()
		return true
	} catch (err) {
		console.log(err)
		return false
	}
}

function prepSQL(sql, statements) {
	return mysql.format(sql, statements)
}

module.exports = {
	SELECT,
	EXECUTE,
	prepSQL
}
