const check = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM11.0026 16L6.75999 11.7574L8.17421 10.3431L11.0026 13.1716L16.6595 7.51472L18.0737 8.92893L11.0026 16Z"></path></svg>`
const cross = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM12 10.5858L14.8284 7.75736L16.2426 9.17157L13.4142 12L16.2426 14.8284L14.8284 16.2426L12 13.4142L9.17157 16.2426L7.75736 14.8284L10.5858 12L7.75736 9.17157L9.17157 7.75736L12 10.5858Z"></path></svg>`

const username = document.querySelector("input[name='username']")
const password = document.querySelector("input[name='password']")
const submit   = document.querySelector("#submit")

const usernameMin =  3
const usernameMax = 30
const passwordMin =  6
const passwordMax = 60

let validUsername = false
let validPassword = false

function validateRule(rule) {
	const ruleElement = document.querySelector(`#${rule}-rule`)
	const svg = document.querySelector(`#${rule}-rule svg`)
	let length, min, max
	switch (rule) {
		case "username": length = username.value.length; min = usernameMin; max = usernameMax; break
		case "password": length = password.value.length; min = passwordMin; max = passwordMax; break
	}
	if (length >= min && length <= max) {
		ruleElement.classList.add("valid")
		svg.outerHTML = check
		rule === "username" ? validUsername = true : validPassword = true
	} else {
		ruleElement.classList.remove("valid")
		svg.outerHTML = cross
		rule === "username" ? validUsername = false : validPassword = false
	}

	if (validUsername && validPassword) {
		submit.classList.add("valid")
	} else {
		submit.classList.remove("valid")
	}
}

username.onkeyup = () => { validateRule("username") }
password.onkeyup = () => { validateRule("password") }

validateRule("username")
validateRule("password")

document.querySelector("#username-rule span").innerHTML = usernameMin + "-" + usernameMax
document.querySelector("#password-rule span").innerHTML = passwordMin + "-" + passwordMax
