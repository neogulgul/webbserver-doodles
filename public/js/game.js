const socket = io()

socket.emit("game-join", getToken())

const main          = document.querySelector("main")

const gameStatus    = document.querySelector("#game-status")

const canvas        = document.querySelector("#canvas")
const background    = document.querySelector("#background")
const backgroundCtx = background.getContext("2d")
const foreground    = document.querySelector("#foreground")
const foregroundCtx = foreground.getContext("2d")

const colorPalette  = document.querySelector("#color-palette")
const sizePicker    = document.querySelector("#size-picker")

const clearButton   = document.querySelector("#clear")
const  fillButton   = document.querySelector("#fill")

const playerCount   = document.querySelector("#player-count")
const playerList    = document.querySelector("#player-list")

const messages      = document.querySelector("#messages")
const chatInput     = document.querySelector("#chat input")

const gameTimer     = document.querySelector("#game-timer")

const canvasSize = { width: 1024, height: 1024 }
background.width = canvasSize.width; background.height = canvasSize.height
foreground.width = canvasSize.width; foreground.height = canvasSize.height

const sizes = {
	tiny:    8,
	small:  16,
	medium: 32,
	large:  64
}

const colors = {
	black:  "#000000",
	white:  "#ffffff",
	gray:   "#cccccc",
	red:    "#dc143c",
	orange: "#ffb347",
	yellow: "#ffe135",
	green:  "#228b22",
	blue:   "#4169e1",
	cyan:   "#b9f2ff",
	purple: "#9370db",
	pink:   "#fddde6",
	brown:  "#8b4513",
}

const settings = {
	size: "medium",
	color: "black"
}

let isCurrentDrawer = false

let touchEnd = false

function getToken() {
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

	return cookieObject["token"]
}

function getSize(size) { return sizes[size] }

function getColor(color) { return colors[color] }

function leftClicking(event) { return event.buttons === 1 }

function clearForeground() { foregroundCtx.clearRect(0, 0, canvasSize.width, canvasSize.height) }

function clearBackground(color = "white") {
	backgroundCtx.beginPath()
	backgroundCtx.fillStyle = colors[color]
	backgroundCtx.fillRect(0, 0, canvasSize.width, canvasSize.height)
	backgroundCtx.fill()
}

function clientToCanvasPosition(clientX, clientY, canvas) {
	const canvasBounds = canvas.getBoundingClientRect()

	const canvasDimensions = {
		x: Math.ceil(canvasBounds.x),
		y: Math.ceil(canvasBounds.y),
		width:  Math.round(canvasBounds.width)  - 1,
		height: Math.round(canvasBounds.height) - 1
	}

	const x = (clientX - canvasDimensions.x) / canvasDimensions.width  * canvas.width
	const y = (clientY - canvasDimensions.y) / canvasDimensions.height * canvas.height

	return { x: x, y: y }
}

function draw(size, color, position, dot) {
	backgroundCtx.lineCap = "round"
	backgroundCtx.lineWidth = size
	backgroundCtx.strokeStyle = color

	if (dot) {
		backgroundCtx.beginPath()
		backgroundCtx.moveTo(position.x, position.y)
		backgroundCtx.lineTo(position.x, position.y)
		backgroundCtx.stroke()
	}
	else {
		backgroundCtx.lineTo(position.x, position.y)
		backgroundCtx.stroke()
		backgroundCtx.beginPath()
		backgroundCtx.moveTo(position.x, position.y)
	}
}

function drawCursor(position) {
	if (!isCurrentDrawer) { return }

	const radius = getSize(settings.size) / 2
	const color = getColor(settings.color)

	// circle
	foregroundCtx.beginPath()
	foregroundCtx.fillStyle = color + "90" // 0.9 opacity
	foregroundCtx.arc(position.x, position.y, radius, 0, Math.PI * 2)
	foregroundCtx.fill()

	// white outline
	foregroundCtx.beginPath()
	foregroundCtx.strokeStyle = colors.white
	foregroundCtx.arc(position.x, position.y, radius, 0, Math.PI * 2)
	foregroundCtx.stroke()

	// black outline
	foregroundCtx.beginPath()
	foregroundCtx.strokeStyle = colors.black
	foregroundCtx.arc(position.x, position.y, radius + 2, 0, Math.PI * 2)
	foregroundCtx.stroke()
}

function toggleDOMsetting(setting) {
	const prevSelected = document.querySelector("." + setting + ".selected")
	if (prevSelected) {
		prevSelected.classList.remove("selected")
	}
	const currSelected = document.querySelector("#" + settings[setting])
	currSelected.classList.add("selected")
}

function selfClear() {
	socket.emit("game-clear", socket.id)
}

function selfFill() {
	socket.emit("game-fill", socket.id, settings.color)
}

function selfDraw(position, dot = false) {
	const size = getSize(settings.size)
	const color = getColor(settings.color)
	socket.emit("game-draw", socket.id, size, color, position, dot)
}

function validDrawPosition(event) {
	return event.target === background || event.target === main
}

window.onkeydown = (event) => {
	if (document.activeElement === chatInput) { return }
	const key = event.key.toLowerCase()
	switch (key) {
		case "c":
			selfClear()
			break
		case "f":
			selfFill()
			break
	}
}

window.onmousedown = (event) => {
	if (!leftClicking(event) || !validDrawPosition(event)) { return }
	selfDraw(clientToCanvasPosition(event.clientX, event.clientY, background), true)
}

window.onmousemove = (event) => {
	clearForeground()
	if (!touchEnd) { // preventing cursor when using touch
		drawCursor(clientToCanvasPosition(event.clientX, event.clientY, foreground))
	}
	touchEnd = false

	if (!leftClicking(event) || !validDrawPosition(event)) { return }
	selfDraw(clientToCanvasPosition(event.clientX, event.clientY, background))
}

window.ontouchstart = (event) => {
	if (!validDrawPosition(event)) { return }
	selfDraw(clientToCanvasPosition(event.changedTouches[0].clientX, event.changedTouches[0].clientY, background), true)
}

window.ontouchmove = (event) => {
	if (!validDrawPosition(event)) { return }
	selfDraw(clientToCanvasPosition(event.changedTouches[0].clientX, event.changedTouches[0].clientY, background))
}

window.ontouchend = () => {
	touchEnd = true
}

document.body.onload = () => {
	const menuItemTitles = document.querySelectorAll("#menu li p")
	const dropDownSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 15.0006L7.75732 10.758L9.17154 9.34375L12 12.1722L14.8284 9.34375L16.2426 10.758L12 15.0006Z"></path></svg>`

	menuItemTitles.forEach((title) => {
		title.innerHTML += dropDownSVG

		title.onclick = () => {
			const parent = title.parentElement
			const activeMenuItem = document.querySelector("#menu .active")
			if (activeMenuItem && activeMenuItem !== parent) {
				activeMenuItem.classList.remove("active")
			}
			parent.classList.toggle("active")
		}
	})

	Object.keys(sizes).forEach((size) => {
		sizePicker.innerHTML += `<div id="${size}" class="size"></div>`
		const sizeDiv = document.querySelector("#" + size)
		sizeDiv.style.setProperty("--size", getSize(size) + "px")
	})

	Object.keys(colors).forEach((color) => {
		colorPalette.innerHTML += `<div id="${color}" class="color"></div>`
		const colorDiv = document.querySelector("#" + color)
		colorDiv.style.backgroundColor = getColor(color)
	})

	Object.keys(settings).forEach((setting) => {
		toggleDOMsetting(setting)
	})

	const DOMsizes = document.querySelectorAll("#size-picker .size")
	DOMsizes.forEach((size) => {
		size.onclick = () => {
			settings.size = size.id
			toggleDOMsetting("size")
		}
	})

	const DOMcolors = document.querySelectorAll("#color-palette .color")
	DOMcolors.forEach((color) => {
		color.onclick = () => {
			settings.color = color.id
			toggleDOMsetting("color")
		}
	})

	document.body.onclick = (event) => {
		const activeMenuItem = document.querySelector("#menu .active")
		if (activeMenuItem && !activeMenuItem.contains(event.target)) {
			activeMenuItem.classList.remove("active")
		}
	}
	
	// send message
	chatInput.onkeydown = (event) => {
		if (chatInput.value && event.key === "Enter") {
			socket.emit("game-player-message", socket.id, chatInput.value)
			chatInput.value = ""
		}
	}

	clearButton.onclick = () => {
		selfClear()
	}

	fillButton.onclick = () => {
		selfFill()
	}
}

// socket.io stuff ↓
// socket.io stuff ↓
// socket.io stuff ↓

socket.on("game-clear", () => {
	clearBackground()
})

socket.on("game-fill", (color) => {
	clearBackground(color)
})

socket.on("game-draw", (size, color, position, dot) => {
	draw(size, color, position, dot)
})

socket.on("game-already-playing", () => {
	window.location.href = "/already-playing"
})

socket.on("game-lobby-change", (game) => {
	playerList.innerHTML = ""
	let i = 0
	Object.keys(game.lobby).forEach((key) => {
		i++
		const name = game.lobby[key].name
		const id = game.lobby[key].id
		if (key === socket.id) {
			playerList.innerHTML += `<li class="you">#${id} ${name} (you)</li>`
		} else {
			playerList.innerHTML += `<li>#${id} ${name}</li>`
		}
	})
	playerCount.innerHTML = "Players: " + i
})

socket.on("game-player-message", (senderSocketId, id, name, message) => {
	if (socket.id === senderSocketId) {
		messages.innerHTML += `<li class="you">#${id} ${name} (you): ${message}</li>`
		messages.scrollTop = messages.scrollHeight
	} else {
		messages.innerHTML += `<li>#${id} ${name}: ${message}</li>`
	}
})

socket.on("game-server-message", (message) => {
	messages.innerHTML += `<li class="server">${message}</li>`
})

socket.on("game-round-start", (drawerSocketId = undefined) => {
	isCurrentDrawer = socket.id === drawerSocketId
	document.body.classList.add("is-playing")
	if (isCurrentDrawer) {
		document.body.classList.add("is-current-drawer")
	}
})

socket.on("game-round-end", () => {
	isCurrentDrawer = false
	const thingsToRemove = ["is-playing", "is-current-drawer", "is-correct"]
	for (let i = 0; i < thingsToRemove.length; i++) {
		document.body.classList.remove(thingsToRemove[i])
	}
	clearBackground()
})

socket.on("game-load-canvas", (drawCommandsDuringRound) => {
	drawCommandsDuringRound.forEach((command) => {
		draw(command.size, command.color, command.position, command.dot)
	})
})

socket.on("game-set-status", (statusMessage) => {
	gameStatus.innerHTML = statusMessage
})

socket.on("game-correct-guess", () => {
	document.body.classList.add("is-correct")
})

socket.on("game-update-timer", (percentage) => {
	gameTimer.style.setProperty("--percentage", percentage + "%")
})
