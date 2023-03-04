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

function getSize(size) { return sizes[size] }

function getColor(color) { return colors[color] }

function leftClicking(event) { return event.buttons === 1 }

function clearContext(ctx) { ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height) }

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

function draw(position, dot = false) {
	backgroundCtx.lineCap = "round"
	backgroundCtx.lineWidth = getSize(settings.size)
	backgroundCtx.strokeStyle = getColor(settings.color)

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

function drawCursor(x, y) {
	const radius = getSize(settings.size) / 2
	const color = getColor(settings.color)

	// circle
	foregroundCtx.beginPath()
	foregroundCtx.fillStyle = color + "90" // 0.9 opacity
	foregroundCtx.arc(x, y, radius, 0, Math.PI * 2)
	foregroundCtx.fill()

	// white outline
	foregroundCtx.beginPath()
	foregroundCtx.strokeStyle = colors["white"]
	foregroundCtx.arc(x, y, radius, 0, Math.PI * 2)
	foregroundCtx.stroke()

	// black outline
	foregroundCtx.beginPath()
	foregroundCtx.strokeStyle = colors["black"]
	foregroundCtx.arc(x, y, radius + 2, 0, Math.PI * 2)
	foregroundCtx.stroke()
}

window.onkeydown = (event) => {
	const key = event.key.toLowerCase()
	if (key === "c") { clearContext(backgroundCtx) }
}

window.onmousedown = (event) => {
	if (!leftClicking(event)) { return }
	draw(clientToCanvasPosition(event.clientX, event.clientY, background), true)
}

window.onmousemove = (event) => {
	clearContext(foregroundCtx)
	const pos = clientToCanvasPosition(event.clientX, event.clientY, foreground)
	drawCursor(pos.x, pos.y)

	if (!leftClicking(event)) { return }
	draw(clientToCanvasPosition(event.clientX, event.clientY, background))
}

document.body.onload = () => {
	const colorPalette = document.querySelector("#color-palette")
	const sizePicker = document.querySelector("#size-picker")

	Object.keys(colors).forEach((color) => {
		colorPalette.innerHTML += `<div id="${color}" class="color"></div>`
		const colorDiv = document.querySelector("#" + color)
		colorDiv.style.backgroundColor = getColor(color)
	})

	Object.keys(sizes).forEach((size) => {
		sizePicker.innerHTML += `<div id="${size}" class="size"></div>`
		const sizeDiv = document.querySelector("#" + size)
		sizeDiv.style.setProperty("--size", getSize(size) + "px")
		sizeDiv.style.width = getSize("large") + "px"
		sizeDiv.style.height = getSize("large") + "px"
	})

	const DOMcolors = document.querySelectorAll("#color-palette .color")
	DOMcolors.forEach((color) => {
		color.onclick = () => {
			settings.color = color.id
		}
	})

	const DOMsizes = document.querySelectorAll("#size-picker .size")
	DOMsizes.forEach((size) => {
		size.onclick = () => {
			settings.size = size.id
		}
	})
}
