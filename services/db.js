const mysql = require("mysql2/promise")

async function getConnection() {
	return mysql.createConnection({
		host: "localhost",
		user: "root",
		password: "",
		database: "doodles"
	})
}

function prepSQL(sql, statements) {
	return mysql.format(sql, statements)
}

async function execute(statement) {
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

module.exports = {
	prepSQL,
	execute
}
