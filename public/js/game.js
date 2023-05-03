const socket = io()

const cookieString = document.cookie
const cookieArray = cookieString.split("; ")
const cookieObject = {}

const cookies = cookieArray.length
for (let i = 0; i < cookies; i++) {
	const keyAndValue = cookieArray[i].split("=")
	const key = keyAndValue[0]
	const value = keyAndValue[1]
	cookieObject[key] = value
}

function getToken() { return cookieObject["token"] }

socket.emit("game-join", getToken())

const button = document.querySelector("button")
button.onclick = () => {
	socket.emit("game-win")
}

socket.on("game-already-playing", () => {
	window.location.href = "/already-playing"
})

const playerList = document.querySelector("#player-list")
socket.on("game-lobby-change", (lobby) => {
	playerList.innerHTML = ""
	let i = 0
	Object.values(lobby).forEach((value) => {
		i++
		playerList.innerHTML += `<li>#${i} ${value}</li>`
	})
})
