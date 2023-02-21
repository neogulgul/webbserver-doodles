function degToRad(deg) { return deg * (Math.PI / 180) }
function radToDeg(rad) { return rad * (180 / Math.PI) }

const canvas = document.querySelector("canvas")
const ctx = canvas.getContext("2d")
const currentColor = document.querySelector("#current-color")
const colorPalette = document.querySelector("#color-palette")

const canvasSize = {
	x: 1024,
	y: 1024
}

canvas.width  = canvasSize.x
canvas.height = canvasSize.y

function leftClick(event) {
	return event.button === 0
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
	radius: 10,
	color: "black",
	getColorHex: () => { return colors[settings.color] }
}

let drawing = false
const pos = {
	x: undefined,
	y: undefined
}

function resetPos() {
	pos.x = undefined
	pos.y = undefined
}

function draw(x, y) {
	const canvasBounds = canvas.getBoundingClientRect()

	const canvasPos = {
		x: Math.ceil(canvasBounds.x),
		y: Math.ceil(canvasBounds.y)
	}

	const canvasDimensions = {
		width:  Math.round(canvasBounds.width)  - 1,
		height: Math.round(canvasBounds.height) - 1
	}

	const lastPos = {
		x: pos.x,
		y: pos.y
	}

	pos.x = (x - canvasPos.x) / canvasDimensions.width  * canvasSize.x
	pos.y = (y - canvasPos.y) / canvasDimensions.height * canvasSize.y

	const deltaPos = {
		x: pos.x - lastPos.x || 0,
		y: pos.y - lastPos.y || 0
	}

	let deltaDistance = Math.sqrt(Math.pow(deltaPos.x, 2) + Math.pow(deltaPos.y, 2))

	if (deltaDistance === 0)
	{
		drawCircle(pos.x, pos.y, settings.radius, settings.getColorHex())
	}
	else
	{
		const angle = Math.atan(deltaPos.x / deltaPos.y)
		const currPos = {
			x: lastPos.x,
			y: lastPos.y
		}
		while (deltaDistance !== 0) {
			const deltaStep = 1
			currPos.x += Math.sin(angle) * deltaStep
			currPos.y += Math.cos(angle) * deltaStep
			deltaDistance -= deltaStep
			if (deltaDistance < 0) {
				deltaDistance = 0
				currPos.x = pos.x
				currPos.y = pos.y
			}
			drawCircle(currPos.x, currPos.y, settings.radius, settings.getColorHex())
		}
	}
}

window.onmousedown = (event) => {
	if (!leftClick(event)) { return }
	drawing = true
	draw(event.clientX, event.clientY)
}

window.onmouseup = (event) => {
	if (!leftClick(event)) { return }
	drawing = false
	resetPos()
}

canvas.onmousemove = (event) => {
	if (!drawing) { return }
	draw(event.clientX, event.clientY)
}

canvas.onmouseout = () => {
	resetPos()
}

window.ontouchstart = (event) => {
	drawing = true
	draw(event.changedTouches[0].clientX, event.changedTouches[0].clientY)
}

window.ontouchend = () => {
	drawing = false
	resetPos()
}

canvas.ontouchmove = (event) => {
	if (!drawing) { return }
	draw(event.changedTouches[0].clientX, event.changedTouches[0].clientY)
}

function drawCircle(x, y, radius, color) {
	ctx.beginPath()
	ctx.fillStyle = color
	ctx.strokeStyle = color
	ctx.arc(x, y, radius, 0, Math.PI * 2)
	ctx.fill()
	ctx.stroke()
}

function clearCanvas() {
	ctx.beginPath()
	ctx.fillStyle = colors.white
	ctx.fillRect(0, 0, canvasSize.x, canvasSize.y)
	ctx.fill()
}

window.onkeydown = (event) => {
	const key = event.key
	if (key === "c") {
		clearCanvas()
	}
}

function updateCurrentColor() {
	currentColor.style.backgroundColor = settings.getColorHex()
	currentColor.innerHTML = `<div class="info">Current color (${settings.color})</div>`
}

function main() {
	clearCanvas()

	updateCurrentColor()

	Object.keys(colors).forEach((color) => {
		colorPalette.innerHTML += `<div id="${color}" class="color"></div>`
		const colorDiv = document.querySelector("#" + color)
		colorDiv.style.backgroundColor = colors[color]
		colorDiv.innerHTML = `<div class="info">${color}</div>`
	})

	const DOMcolors = document.querySelectorAll("#color-palette .color")
	DOMcolors.forEach((color) => {
		color.onclick = () => {
			settings.color = color.id
			updateCurrentColor()
		}
	})
}

main()
