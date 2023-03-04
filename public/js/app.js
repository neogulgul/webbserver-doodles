const socket = io()

const background    = document.querySelector("#background")
const backgroundCtx = background.getContext("2d")
const foreground    = document.querySelector("#foreground")
const foregroundCtx = foreground.getContext("2d")

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

let touchEnd = false

function getSize(size) { return sizes[size] }

function getColor(color) { return colors[color] }

function leftClicking(event) { return event.buttons === 1 }

function clearForeground() { foregroundCtx.clearRect(0, 0, canvasSize.width, canvasSize.height) }

function clearBackground() {
	backgroundCtx.beginPath()
	backgroundCtx.fillStyle = colors.white
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
	socket.emit("clear")
	clearBackground()
}

function selfDraw(position, dot = false) {
	const size = getSize(settings.size)
	const color = getColor(settings.color)
	draw(size, color, position, dot)
	socket.emit("draw", size, color, position, dot)
}

window.onkeydown = (event) => {
	const key = event.key.toLowerCase()
	if (key === "c") { selfClear() }
}

window.onmousedown = (event) => {
	if (!leftClicking(event)) { return }
	selfDraw(clientToCanvasPosition(event.clientX, event.clientY, background), true)
}

window.onmousemove = (event) => {
	clearForeground()
	if (!touchEnd) { // preventing cursor when using touch
		drawCursor(clientToCanvasPosition(event.clientX, event.clientY, foreground))
	}
	touchEnd = false

	if (!leftClicking(event)) { return }
	selfDraw(clientToCanvasPosition(event.clientX, event.clientY, background))
}

window.ontouchstart = (event) => {
	selfDraw(clientToCanvasPosition(event.changedTouches[0].clientX, event.changedTouches[0].clientY, background), true)
}

window.ontouchmove = (event) => {
	selfDraw(clientToCanvasPosition(event.changedTouches[0].clientX, event.changedTouches[0].clientY, background))
}

window.ontouchend = () => {
	touchEnd = true
}

document.body.onload = () => {
	const sizePicker   = document.querySelector("#size-picker")
	const colorPalette = document.querySelector("#color-palette")

	Object.keys(sizes).forEach((size) => {
		sizePicker.innerHTML += `<div id="${size}" class="size"></div>`
		const sizeDiv = document.querySelector("#" + size)
		sizeDiv.style.setProperty("--size", getSize(size) + "px")
		sizeDiv.style.width = getSize("large") + "px"
		sizeDiv.style.height = getSize("large") + "px"
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

	selfClear() // temporary, this clears everyones backgrounds whenever someone new connects
}

socket.on("clear", () => {
	clearBackground()
})

socket.on("draw", (size, color, position, dot) => {
	draw(size, color, position, dot)
})
