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
	const connection = await getConnection()
	const result = await connection.execute(statement)
	await connection.end()
	return result[0]
}

async function INSERT(statement) {
	const connection = await getConnection()
	await connection.execute(statement)
	await connection.end()
}

function prepSQL(sql, statements) {
	return mysql.format(sql, statements)
}

module.exports = {
	SELECT,
	INSERT,
	prepSQL
}
